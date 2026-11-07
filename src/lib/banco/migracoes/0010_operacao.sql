-- Etapa 7, Fase 7A (D-082): reforço da auditoria (C6) e papel restrito de monitoramento.
-- Migração aditiva: nenhuma linha existente é alterada, nenhuma regra de acesso é afrouxada.

-- C6.1 — Papel do banco em cada registro da auditoria. Distingue a aplicação (crm_app) das rotinas
-- privilegiadas (conexão administrativa). Registros anteriores ficam sem a informação.
ALTER TABLE "registro_auditoria" ADD COLUMN "papel_banco" text;--> statement-breakpoint

-- Papel efetivo da operação: o definido com SET ROLE (testes no PGlite) ou o da própria conexão
-- (Supabase). Lido dentro do gatilho, que roda com privilégio controlado.
CREATE FUNCTION papel_da_operacao() RETURNS text
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(nullif(current_setting('role', true), 'none'), session_user::text)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION registrar_auditoria() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_operacao operacao_auditoria;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_operacao := 'inclusao';
  ELSIF TG_OP = 'DELETE' THEN
    v_operacao := 'exclusao';
  ELSE
    -- Alterações que não mudam nenhum dado não geram registro.
    IF (to_jsonb(OLD) - 'atualizado_em' - 'atualizado_por')
       = (to_jsonb(NEW) - 'atualizado_em' - 'atualizado_por') THEN
      RETURN NULL;
    END IF;
    IF to_jsonb(OLD) ->> 'arquivado_em' IS NULL AND to_jsonb(NEW) ->> 'arquivado_em' IS NOT NULL THEN
      v_operacao := 'arquivamento';
    ELSIF to_jsonb(OLD) ->> 'arquivado_em' IS NOT NULL AND to_jsonb(NEW) ->> 'arquivado_em' IS NULL THEN
      v_operacao := 'reativacao';
    ELSE
      v_operacao := 'alteracao';
    END IF;
  END IF;

  INSERT INTO registro_auditoria (tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id, papel_banco)
  VALUES (
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_operacao,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    usuario_da_sessao(),
    papel_da_operacao()
  );
  RETURN NULL;
END
$$;
--> statement-breakpoint

-- C6.2 — Nenhuma tabela pode ser esvaziada de uma vez, nem pelo dono do banco. Vale também para
-- tabelas futuras: o teste testes/auditoria-c6.test.ts falha se alguma ficar sem este gatilho.
CREATE FUNCTION impedir_esvaziamento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Os registros do CRM não podem ser apagados em massa (tabela %).', TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END
$$;
--> statement-breakpoint

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE %s ON %I FOR EACH STATEMENT EXECUTE FUNCTION impedir_esvaziamento()',
      r.relname || '_sem_esvaziamento', 'TRUNCATE', r.relname
    );
  END LOOP;
END
$$;
--> statement-breakpoint

-- Monitoramento (A3): papel sem acesso a nenhuma tabela, função ou dado do CRM. Só consegue
-- conectar e responder a consultas que não leem tabelas de negócio (como "select 1" e o catálogo
-- do PostgreSQL). Nasce sem login; a senha é definida fora das migrações, só no projeto de
-- desenvolvimento (scripts/monitor-preparar.ts), para nunca constar do código.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_monitor') THEN
    CREATE ROLE crm_monitor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT
      CONNECTION LIMIT 2;
  END IF;
END
$$;
--> statement-breakpoint
ALTER ROLE crm_monitor SET statement_timeout = '5s';--> statement-breakpoint
ALTER ROLE crm_monitor SET idle_in_transaction_session_timeout = '10s';--> statement-breakpoint
-- As funções do CRM já não podem ser executadas por PUBLIC (migração 0009); as novas também não.
REVOKE ALL ON FUNCTION papel_da_operacao() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION impedir_esvaziamento() FROM PUBLIC;
