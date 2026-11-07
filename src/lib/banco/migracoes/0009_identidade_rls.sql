-- Etapa 5 (D-074, D-075): identidade autenticada e regras de acesso no próprio banco.
-- Migração aditiva: nenhuma linha existente é alterada.
--
-- Como funciona:
--  * A aplicação conecta-se com o papel crm_app (sem BYPASSRLS, sem ser dono das tabelas).
--  * Cada operação ocorre em uma transação com set_config('app.usuario_id', <id>, true).
--  * Sem identidade, ou com usuário inativo, as regras negam tudo: zero linhas.
--  * Situação e permissões são lidas no banco a cada consulta: revogar vale de imediato,
--    mesmo com sessão ainda válida.
--  * Só PostgreSQL padrão, sem depender do esquema auth do Supabase: as mesmas regras
--    valem no PGlite e no Supabase.

ALTER TABLE "usuario" ADD COLUMN "auth_id" uuid;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_auth_id_unico" UNIQUE("auth_id");--> statement-breakpoint

-- Papel da aplicação. Aqui nasce sem login; a senha é definida fora das migrações,
-- apenas no projeto Supabase, para nunca constar do código.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_app') THEN
    CREATE ROLE crm_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint

-- Auditoria: passa a aceitar tabelas sem a coluna arquivado_em (usuario).
CREATE OR REPLACE FUNCTION registrar_auditoria() RETURNS trigger
LANGUAGE plpgsql AS $$
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

  INSERT INTO registro_auditoria (tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id)
  VALUES (
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_operacao,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    usuario_da_sessao()
  );
  RETURN NULL;
END
$$;
--> statement-breakpoint

CREATE FUNCTION atualizar_data_usuario() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.criado_em := OLD.criado_em;
  NEW.atualizado_em := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER usuario_atualizado BEFORE UPDATE ON usuario
  FOR EACH ROW EXECUTE FUNCTION atualizar_data_usuario();
--> statement-breakpoint
CREATE TRIGGER usuario_auditoria AFTER INSERT OR UPDATE OR DELETE ON usuario
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER usuario_sem_exclusao BEFORE DELETE ON usuario
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint

-- Os gatilhos existentes passam a executar com privilégio controlado: leem e gravam
-- o que precisam sem serem afetados pelas regras de acesso, com search_path fixo.
DO $$
DECLARE
  v_funcao regprocedure;
BEGIN
  FOR v_funcao IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER SET search_path = public, pg_temp', v_funcao);
  END LOOP;
END
$$;
--> statement-breakpoint

-- Funções usadas pelas regras ------------------------------------------------------

-- Data de referência das validades, no fuso de Brasília (o servidor pode estar em UTC).
CREATE FUNCTION hoje_em_brasilia() RETURNS date
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date
$$;
--> statement-breakpoint

CREATE FUNCTION sessao_ativa() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM usuario WHERE id = usuario_da_sessao() AND situacao = 'ativo')
$$;
--> statement-breakpoint

CREATE FUNCTION sessao_e_administrador() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuario WHERE id = usuario_da_sessao() AND situacao = 'ativo' AND administrador
  )
$$;
--> statement-breakpoint

-- Permissões válidas do usuário da sessão: não arquivadas e não vencidas, de usuário ativo.
CREATE FUNCTION perfis_da_sessao() RETURNS TABLE (projeto_tema_id uuid, perfil perfil_contexto)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT pc.projeto_tema_id, pc.perfil
  FROM permissao_contexto pc
  JOIN usuario u ON u.id = pc.usuario_id AND u.situacao = 'ativo'
  WHERE pc.usuario_id = usuario_da_sessao()
    AND pc.arquivado_em IS NULL
    AND (pc.valida_ate IS NULL OR pc.valida_ate >= hoje_em_brasilia())
$$;
--> statement-breakpoint

CREATE FUNCTION pode_ver_projeto(p_projeto uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sessao_e_administrador()
    OR EXISTS (SELECT 1 FROM perfis_da_sessao() s WHERE s.projeto_tema_id = p_projeto)
$$;
--> statement-breakpoint

CREATE FUNCTION pode_editar_projeto(p_projeto uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sessao_e_administrador()
    OR EXISTS (
      SELECT 1 FROM perfis_da_sessao() s
      WHERE s.projeto_tema_id = p_projeto AND s.perfil IN ('gestor', 'colaborador')
    )
$$;
--> statement-breakpoint

-- Decisão sobre versões do plano: administrador ou gestor do projeto ou tema (D-074, D3).
CREATE FUNCTION pode_decidir_projeto(p_projeto uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sessao_e_administrador()
    OR EXISTS (SELECT 1 FROM perfis_da_sessao() s WHERE s.projeto_tema_id = p_projeto AND s.perfil = 'gestor')
$$;
--> statement-breakpoint

-- Registrar no Cadastro Mestre compartilhado: administrador, ou gestor ou colaborador em algum contexto.
CREATE FUNCTION pode_editar_algum() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sessao_e_administrador()
    OR EXISTS (SELECT 1 FROM perfis_da_sessao() s WHERE s.perfil IN ('gestor', 'colaborador'))
$$;
--> statement-breakpoint

-- Contatos pessoais e observações (P-054, provisória): administrador; gestor ou colaborador
-- com permissão válida em projeto ou tema ao qual o stakeholder esteja associado.
CREATE FUNCTION pode_ver_dados_restritos(p_stakeholder uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sessao_e_administrador()
    OR EXISTS (
      SELECT 1
      FROM stakeholder_contexto sc
      JOIN perfis_da_sessao() s ON s.projeto_tema_id = sc.projeto_tema_id
      WHERE sc.stakeholder_id = p_stakeholder
        AND sc.arquivado_em IS NULL
        AND (sc.data_fim IS NULL OR sc.data_fim >= hoje_em_brasilia())
        AND s.perfil IN ('gestor', 'colaborador')
    )
$$;
--> statement-breakpoint

-- Registro recém-criado nesta mesma transação, antes de receber as suas ligações.
CREATE FUNCTION criado_nesta_transacao(p_criado_por uuid, p_criado_em timestamptz) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sessao_ativa() AND p_criado_por = usuario_da_sessao() AND p_criado_em = transaction_timestamp()
$$;
--> statement-breakpoint

-- Registros compartilhados: visíveis com permissão em ao menos um dos contextos ligados.
CREATE FUNCTION pode_ver_iniciativa(p_iniciativa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sessao_e_administrador()
    OR EXISTS (
      SELECT 1
      FROM iniciativa_projeto_tema ipt
      JOIN perfis_da_sessao() s ON s.projeto_tema_id = ipt.projeto_tema_id
      WHERE ipt.iniciativa_id = p_iniciativa AND ipt.arquivado_em IS NULL
    )
$$;
--> statement-breakpoint

CREATE FUNCTION pode_editar_iniciativa(p_iniciativa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sessao_e_administrador()
    OR EXISTS (
      SELECT 1
      FROM iniciativa_projeto_tema ipt
      JOIN perfis_da_sessao() s ON s.projeto_tema_id = ipt.projeto_tema_id
      WHERE ipt.iniciativa_id = p_iniciativa AND ipt.arquivado_em IS NULL AND s.perfil IN ('gestor', 'colaborador')
    )
$$;
--> statement-breakpoint

-- Contextos de uma interação: diretos e os das iniciativas ligadas a ela.
CREATE FUNCTION projetos_da_interacao(p_interacao uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT projeto_tema_id FROM interacao_projeto_tema
  WHERE interacao_id = p_interacao AND arquivado_em IS NULL
  UNION
  SELECT ipt.projeto_tema_id
  FROM interacao_iniciativa ii
  JOIN iniciativa_projeto_tema ipt ON ipt.iniciativa_id = ii.iniciativa_id AND ipt.arquivado_em IS NULL
  WHERE ii.interacao_id = p_interacao AND ii.arquivado_em IS NULL
$$;
--> statement-breakpoint

CREATE FUNCTION pode_ver_interacao(p_interacao uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sessao_e_administrador()
    OR EXISTS (
      SELECT 1
      FROM projetos_da_interacao(p_interacao) pi(id)
      JOIN perfis_da_sessao() s ON s.projeto_tema_id = pi.id
    )
$$;
--> statement-breakpoint

CREATE FUNCTION pode_editar_interacao(p_interacao uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sessao_e_administrador()
    OR EXISTS (
      SELECT 1
      FROM projetos_da_interacao(p_interacao) pi(id)
      JOIN perfis_da_sessao() s ON s.projeto_tema_id = pi.id
      WHERE s.perfil IN ('gestor', 'colaborador')
    )
$$;
--> statement-breakpoint

CREATE FUNCTION pode_ver_compromisso(p_interacao uuid, p_iniciativa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sessao_e_administrador()
    OR (p_interacao IS NOT NULL AND pode_ver_interacao(p_interacao))
    OR (p_iniciativa IS NOT NULL AND pode_ver_iniciativa(p_iniciativa))
$$;
--> statement-breakpoint

CREATE FUNCTION pode_editar_compromisso(p_interacao uuid, p_iniciativa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT sessao_e_administrador()
    OR (p_interacao IS NOT NULL AND pode_editar_interacao(p_interacao))
    OR (p_iniciativa IS NOT NULL AND pode_editar_iniciativa(p_iniciativa))
$$;
--> statement-breakpoint

CREATE FUNCTION pode_ver_compromisso_id(p_compromisso uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce((
    SELECT pode_ver_compromisso(interacao_id, iniciativa_id) FROM compromisso WHERE id = p_compromisso
  ), false)
$$;
--> statement-breakpoint

CREATE FUNCTION pode_editar_compromisso_id(p_compromisso uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce((
    SELECT pode_editar_compromisso(interacao_id, iniciativa_id) FROM compromisso WHERE id = p_compromisso
  ), false)
$$;
--> statement-breakpoint

-- Projeto ou tema a que pertence cada registro dependente.
CREATE FUNCTION projeto_da_avaliacao(p_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT projeto_tema_id FROM avaliacao WHERE id = p_id
$$;
--> statement-breakpoint
CREATE FUNCTION projeto_da_versao_avaliacao(p_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT a.projeto_tema_id FROM avaliacao_versao v JOIN avaliacao a ON a.id = v.avaliacao_id WHERE v.id = p_id
$$;
--> statement-breakpoint
CREATE FUNCTION projeto_do_plano(p_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT projeto_tema_id FROM plano_acao WHERE id = p_id
$$;
--> statement-breakpoint
CREATE FUNCTION projeto_da_versao_plano(p_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.projeto_tema_id FROM plano_acao_versao v JOIN plano_acao p ON p.id = v.plano_acao_id WHERE v.id = p_id
$$;
--> statement-breakpoint
CREATE FUNCTION projeto_da_acao(p_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.projeto_tema_id FROM acao a JOIN plano_acao p ON p.id = a.plano_acao_id WHERE a.id = p_id
$$;
--> statement-breakpoint
CREATE FUNCTION projeto_do_marco(p_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.projeto_tema_id
  FROM acao_marco m JOIN acao a ON a.id = m.acao_id JOIN plano_acao p ON p.id = a.plano_acao_id
  WHERE m.id = p_id
$$;
--> statement-breakpoint
CREATE FUNCTION projeto_do_risco(p_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT projeto_tema_id FROM risco WHERE id = p_id
$$;
--> statement-breakpoint
CREATE FUNCTION projeto_do_gatilho(p_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT r.projeto_tema_id FROM risco_gatilho g JOIN risco r ON r.id = g.risco_id WHERE g.id = p_id
$$;
--> statement-breakpoint

-- Quem pode ler cada linha da trilha de auditoria: as mesmas regras do registro de origem.
-- Pessoa e contato trazem observações e dados pessoais nos dados gravados; por isso, só com
-- acesso aos dados restritos. Tabela não prevista aqui fica visível apenas ao administrador.
CREATE FUNCTION pode_ver_auditoria(p_tabela text, p_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT sessao_ativa() THEN RETURN false; END IF;
  IF sessao_e_administrador() THEN RETURN true; END IF;
  CASE p_tabela
    WHEN 'comite', 'instituicao', 'vinculo_pessoa_instituicao', 'metodologia_versao', 'criterio_avaliacao', 'rubrica_nivel' THEN
      RETURN true;
    WHEN 'pessoa' THEN
      RETURN pode_ver_dados_restritos(p_id);
    WHEN 'contato' THEN
      RETURN pode_ver_dados_restritos((SELECT stakeholder_id FROM contato WHERE id = p_id));
    WHEN 'projeto_tema' THEN
      RETURN pode_ver_projeto(p_id);
    WHEN 'projeto_tema_comite' THEN
      RETURN pode_ver_projeto((SELECT projeto_tema_id FROM projeto_tema_comite WHERE id = p_id));
    WHEN 'stakeholder_contexto' THEN
      RETURN pode_ver_projeto((SELECT projeto_tema_id FROM stakeholder_contexto WHERE id = p_id));
    WHEN 'avaliacao' THEN
      RETURN pode_ver_projeto(projeto_da_avaliacao(p_id));
    WHEN 'avaliacao_versao' THEN
      RETURN pode_ver_projeto(projeto_da_versao_avaliacao(p_id));
    WHEN 'avaliacao_nota_criterio' THEN
      RETURN pode_ver_projeto(projeto_da_versao_avaliacao((SELECT avaliacao_versao_id FROM avaliacao_nota_criterio WHERE id = p_id)));
    WHEN 'evidencia' THEN
      RETURN pode_ver_projeto(projeto_da_versao_avaliacao((SELECT avaliacao_versao_id FROM evidencia WHERE id = p_id)));
    WHEN 'iniciativa' THEN
      RETURN pode_ver_iniciativa(p_id);
    WHEN 'iniciativa_projeto_tema' THEN
      RETURN pode_ver_projeto((SELECT projeto_tema_id FROM iniciativa_projeto_tema WHERE id = p_id));
    WHEN 'iniciativa_stakeholder' THEN
      RETURN pode_ver_iniciativa((SELECT iniciativa_id FROM iniciativa_stakeholder WHERE id = p_id));
    WHEN 'interacao' THEN
      RETURN pode_ver_interacao(p_id);
    WHEN 'interacao_projeto_tema' THEN
      RETURN pode_ver_projeto((SELECT projeto_tema_id FROM interacao_projeto_tema WHERE id = p_id));
    WHEN 'interacao_participante' THEN
      RETURN pode_ver_interacao((SELECT interacao_id FROM interacao_participante WHERE id = p_id));
    WHEN 'interacao_iniciativa' THEN
      RETURN (
        SELECT pode_ver_interacao(interacao_id) AND pode_ver_iniciativa(iniciativa_id)
        FROM interacao_iniciativa WHERE id = p_id
      );
    WHEN 'compromisso' THEN
      RETURN pode_ver_compromisso_id(p_id);
    WHEN 'compromisso_acompanhamento' THEN
      RETURN pode_ver_compromisso_id((SELECT compromisso_id FROM compromisso_acompanhamento WHERE id = p_id));
    WHEN 'plano_acao' THEN
      RETURN pode_ver_projeto(projeto_do_plano(p_id));
    WHEN 'plano_eixo' THEN
      RETURN pode_ver_projeto(projeto_do_plano((SELECT plano_acao_id FROM plano_eixo WHERE id = p_id)));
    WHEN 'plano_acao_versao' THEN
      RETURN pode_ver_projeto(projeto_da_versao_plano(p_id));
    WHEN 'plano_acao_decisao' THEN
      RETURN pode_ver_projeto(projeto_da_versao_plano((SELECT plano_acao_versao_id FROM plano_acao_decisao WHERE id = p_id)));
    WHEN 'acao' THEN
      RETURN pode_ver_projeto(projeto_da_acao(p_id));
    WHEN 'acao_planejamento' THEN
      RETURN pode_ver_projeto(projeto_da_acao((SELECT acao_id FROM acao_planejamento WHERE id = p_id)));
    WHEN 'acao_marco' THEN
      RETURN pode_ver_projeto(projeto_do_marco(p_id));
    WHEN 'marco_planejamento' THEN
      RETURN pode_ver_projeto(projeto_do_marco((SELECT marco_id FROM marco_planejamento WHERE id = p_id)));
    WHEN 'acao_acompanhamento' THEN
      RETURN pode_ver_projeto(projeto_da_acao((SELECT acao_id FROM acao_acompanhamento WHERE id = p_id)));
    WHEN 'acao_stakeholder' THEN
      RETURN pode_ver_projeto(projeto_da_acao((SELECT acao_id FROM acao_stakeholder WHERE id = p_id)));
    WHEN 'risco' THEN
      RETURN pode_ver_projeto(projeto_do_risco(p_id));
    WHEN 'risco_avaliacao' THEN
      RETURN pode_ver_projeto(projeto_do_risco((SELECT risco_id FROM risco_avaliacao WHERE id = p_id)));
    WHEN 'risco_gatilho' THEN
      RETURN pode_ver_projeto(projeto_do_gatilho(p_id));
    WHEN 'risco_gatilho_registro' THEN
      RETURN pode_ver_projeto(projeto_do_gatilho((SELECT gatilho_id FROM risco_gatilho_registro WHERE id = p_id)));
    WHEN 'risco_resposta' THEN
      RETURN pode_ver_projeto(projeto_do_risco((SELECT risco_id FROM risco_resposta WHERE id = p_id)));
    WHEN 'risco_stakeholder' THEN
      RETURN pode_ver_projeto(projeto_do_risco((SELECT risco_id FROM risco_stakeholder WHERE id = p_id)));
    ELSE
      RETURN false;
  END CASE;
END
$$;
--> statement-breakpoint

-- Leitura dos campos restritos: quem não pode vê-los recebe vazio.
CREATE FUNCTION observacoes_da_pessoa(p_pessoa uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT observacoes FROM pessoa WHERE id = p_pessoa AND pode_ver_dados_restritos(p_pessoa)
$$;
--> statement-breakpoint
CREATE FUNCTION observacao_do_contato(p_contato uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT observacao FROM contato WHERE id = p_contato AND pode_ver_dados_restritos(stakeholder_id)
$$;
--> statement-breakpoint

-- Correspondência entre a identidade autenticada e o usuário interno, somente por auth_id.
CREATE FUNCTION identificar_usuario(p_auth_id uuid)
RETURNS TABLE (id uuid, nome text, email text, administrador boolean, situacao situacao_usuario)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT u.id, u.nome, u.email, u.administrador, u.situacao FROM usuario u WHERE u.auth_id = p_auth_id
$$;
--> statement-breakpoint

CREATE FUNCTION existe_outro_administrador(p_usuario uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM usuario WHERE id <> p_usuario AND administrador AND situacao = 'ativo')
$$;
--> statement-breakpoint

-- Regras que valem só para a aplicação (papel crm_app). Estes gatilhos não têm privilégio
-- próprio, para reconhecerem o papel de quem está executando a operação.
CREATE FUNCTION proteger_observacoes_pessoa() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user = 'crm_app'
     AND NEW.observacoes IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.observacoes END)
     AND NOT pode_ver_dados_restritos(NEW.id) THEN
    RAISE EXCEPTION 'Você não tem permissão para alterar as observações deste cadastro.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER pessoa_observacoes_restritas BEFORE INSERT OR UPDATE ON pessoa
  FOR EACH ROW EXECUTE FUNCTION proteger_observacoes_pessoa();
--> statement-breakpoint

CREATE FUNCTION proteger_observacao_contato() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user = 'crm_app'
     AND NEW.observacao IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.observacao END)
     AND NOT pode_ver_dados_restritos(NEW.stakeholder_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para alterar as observações deste cadastro.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER contato_observacao_restrita BEFORE INSERT OR UPDATE ON contato
  FOR EACH ROW EXECUTE FUNCTION proteger_observacao_contato();
--> statement-breakpoint

-- Aprovar, rejeitar ou devolver versão do plano: administrador ou gestor (D-074, D3).
CREATE FUNCTION exigir_decisor_da_versao() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user = 'crm_app'
     AND OLD.situacao = 'em_aprovacao'
     AND NEW.situacao IS DISTINCT FROM OLD.situacao
     AND NOT pode_decidir_projeto(projeto_do_plano(NEW.plano_acao_id)) THEN
    RAISE EXCEPTION 'Somente o administrador ou o gestor do projeto ou tema decide sobre versões do plano.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER plano_acao_versao_decisor BEFORE UPDATE ON plano_acao_versao
  FOR EACH ROW EXECUTE FUNCTION exigir_decisor_da_versao();
--> statement-breakpoint

-- O sistema não fica sem administrador ativo por uma operação da aplicação.
CREATE FUNCTION manter_administrador_ativo() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user = 'crm_app'
     AND OLD.administrador AND OLD.situacao = 'ativo'
     AND (NOT NEW.administrador OR NEW.situacao <> 'ativo')
     AND NOT existe_outro_administrador(OLD.id) THEN
    RAISE EXCEPTION 'O sistema precisa ter ao menos um administrador ativo.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER usuario_mantem_administrador BEFORE UPDATE ON usuario
  FOR EACH ROW EXECUTE FUNCTION manter_administrador_ativo();
--> statement-breakpoint

-- Regras de acesso, tabela por tabela: quem vê, quem inclui e quem altera. Nenhuma tabela
-- aceita exclusão pela aplicação: os registros são arquivados. O vazio (NULL) significa que
-- a aplicação não faz aquela operação. Nenhuma regra depende do esquema auth do Supabase.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- Acesso e auditoria
      ('usuario', 'sessao_ativa()', 'sessao_e_administrador()', 'sessao_e_administrador()'),
      ('permissao_contexto', 'sessao_e_administrador() OR (sessao_ativa() AND usuario_id = usuario_da_sessao())', 'sessao_e_administrador()', 'sessao_e_administrador()'),
      ('registro_auditoria', 'pode_ver_auditoria(tabela, registro_id)', NULL, NULL),
      -- Estrutura institucional
      ('comite', 'sessao_ativa()', 'sessao_e_administrador()', 'sessao_e_administrador()'),
      ('projeto_tema', 'pode_ver_projeto(id)', 'sessao_e_administrador()', 'pode_editar_projeto(id)'),
      ('projeto_tema_comite', 'pode_ver_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)'),
      -- Cadastro Mestre: diretório básico compartilhado (D-074, D4)
      ('stakeholder', 'sessao_ativa()', 'pode_editar_algum()', NULL),
      ('pessoa', 'sessao_ativa()', 'pode_editar_algum()', 'pode_editar_algum()'),
      ('instituicao', 'sessao_ativa()', 'pode_editar_algum()', 'pode_editar_algum()'),
      ('vinculo_pessoa_instituicao', 'sessao_ativa()', 'pode_editar_algum()', 'pode_editar_algum()'),
      ('contato',
        'sessao_ativa() AND (natureza <> ''pessoal'' OR pode_ver_dados_restritos(stakeholder_id))',
        'pode_editar_algum() AND (natureza <> ''pessoal'' OR pode_ver_dados_restritos(stakeholder_id))',
        'pode_editar_algum() AND (natureza <> ''pessoal'' OR pode_ver_dados_restritos(stakeholder_id))'),
      ('stakeholder_contexto', 'pode_ver_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)'),
      -- Metodologia: consulta por todos; alteração pelo administrador
      ('metodologia_versao', 'sessao_ativa()', 'sessao_e_administrador()', 'sessao_e_administrador()'),
      ('criterio_avaliacao', 'sessao_ativa()', 'sessao_e_administrador()', 'sessao_e_administrador()'),
      ('rubrica_nivel', 'sessao_ativa()', 'sessao_e_administrador()', 'sessao_e_administrador()'),
      -- Avaliações
      ('avaliacao', 'pode_ver_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)'),
      ('avaliacao_versao', 'pode_ver_projeto(projeto_da_avaliacao(avaliacao_id))', 'pode_editar_projeto(projeto_da_avaliacao(avaliacao_id))', 'pode_editar_projeto(projeto_da_avaliacao(avaliacao_id))'),
      ('avaliacao_nota_criterio', 'pode_ver_projeto(projeto_da_versao_avaliacao(avaliacao_versao_id))', 'pode_editar_projeto(projeto_da_versao_avaliacao(avaliacao_versao_id))', 'pode_editar_projeto(projeto_da_versao_avaliacao(avaliacao_versao_id))'),
      ('evidencia', 'pode_ver_projeto(projeto_da_versao_avaliacao(avaliacao_versao_id))', 'pode_editar_projeto(projeto_da_versao_avaliacao(avaliacao_versao_id))', 'pode_editar_projeto(projeto_da_versao_avaliacao(avaliacao_versao_id))'),
      -- Iniciativas: registro compartilhado; cada ligação segue o seu próprio contexto
      ('iniciativa', 'pode_ver_iniciativa(id) OR criado_nesta_transacao(criado_por, criado_em)', 'pode_editar_algum()', 'pode_editar_iniciativa(id) OR criado_nesta_transacao(criado_por, criado_em)'),
      ('iniciativa_projeto_tema', 'pode_ver_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)'),
      ('iniciativa_stakeholder', 'pode_ver_iniciativa(iniciativa_id)', 'pode_editar_iniciativa(iniciativa_id)', 'pode_editar_iniciativa(iniciativa_id)'),
      -- Interações e compromissos
      ('interacao', 'pode_ver_interacao(id) OR criado_nesta_transacao(criado_por, criado_em)', 'pode_editar_algum()', 'pode_editar_interacao(id) OR criado_nesta_transacao(criado_por, criado_em)'),
      ('interacao_projeto_tema', 'pode_ver_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)'),
      ('interacao_participante', 'pode_ver_interacao(interacao_id)', 'pode_editar_interacao(interacao_id)', 'pode_editar_interacao(interacao_id)'),
      ('interacao_iniciativa',
        'pode_ver_interacao(interacao_id) AND pode_ver_iniciativa(iniciativa_id)',
        'pode_ver_iniciativa(iniciativa_id) AND (pode_editar_iniciativa(iniciativa_id) OR pode_editar_interacao(interacao_id))',
        'pode_ver_iniciativa(iniciativa_id) AND (pode_editar_iniciativa(iniciativa_id) OR pode_editar_interacao(interacao_id))'),
      ('compromisso', 'pode_ver_compromisso(interacao_id, iniciativa_id)', 'pode_editar_compromisso(interacao_id, iniciativa_id)', 'pode_editar_compromisso(interacao_id, iniciativa_id)'),
      ('compromisso_acompanhamento', 'pode_ver_compromisso_id(compromisso_id)', 'pode_editar_compromisso_id(compromisso_id)', 'pode_editar_compromisso_id(compromisso_id)'),
      -- Plano de ação: quem envia e quem decide
      ('plano_acao', 'pode_ver_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)'),
      ('plano_eixo', 'pode_ver_projeto(projeto_do_plano(plano_acao_id))', 'pode_editar_projeto(projeto_do_plano(plano_acao_id))', 'pode_editar_projeto(projeto_do_plano(plano_acao_id))'),
      ('plano_acao_versao', 'pode_ver_projeto(projeto_do_plano(plano_acao_id))', 'pode_editar_projeto(projeto_do_plano(plano_acao_id))', 'pode_editar_projeto(projeto_do_plano(plano_acao_id))'),
      ('plano_acao_decisao',
        'pode_ver_projeto(projeto_da_versao_plano(plano_acao_versao_id))',
        '(decisao = ''enviada'' AND pode_editar_projeto(projeto_da_versao_plano(plano_acao_versao_id))) OR pode_decidir_projeto(projeto_da_versao_plano(plano_acao_versao_id))',
        NULL),
      ('acao', 'pode_ver_projeto(projeto_do_plano(plano_acao_id))', 'pode_editar_projeto(projeto_do_plano(plano_acao_id))', 'pode_editar_projeto(projeto_do_plano(plano_acao_id))'),
      ('acao_planejamento', 'pode_ver_projeto(projeto_da_acao(acao_id))', 'pode_editar_projeto(projeto_da_acao(acao_id))', 'pode_editar_projeto(projeto_da_acao(acao_id))'),
      ('acao_marco', 'pode_ver_projeto(projeto_da_acao(acao_id))', 'pode_editar_projeto(projeto_da_acao(acao_id))', 'pode_editar_projeto(projeto_da_acao(acao_id))'),
      ('marco_planejamento', 'pode_ver_projeto(projeto_do_marco(marco_id))', 'pode_editar_projeto(projeto_do_marco(marco_id))', 'pode_editar_projeto(projeto_do_marco(marco_id))'),
      ('acao_acompanhamento', 'pode_ver_projeto(projeto_da_acao(acao_id))', 'pode_editar_projeto(projeto_da_acao(acao_id))', 'pode_editar_projeto(projeto_da_acao(acao_id))'),
      ('acao_stakeholder', 'pode_ver_projeto(projeto_da_acao(acao_id))', 'pode_editar_projeto(projeto_da_acao(acao_id))', 'pode_editar_projeto(projeto_da_acao(acao_id))'),
      -- Riscos
      ('risco', 'pode_ver_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)', 'pode_editar_projeto(projeto_tema_id)'),
      ('risco_avaliacao', 'pode_ver_projeto(projeto_do_risco(risco_id))', 'pode_editar_projeto(projeto_do_risco(risco_id))', 'pode_editar_projeto(projeto_do_risco(risco_id))'),
      ('risco_gatilho', 'pode_ver_projeto(projeto_do_risco(risco_id))', 'pode_editar_projeto(projeto_do_risco(risco_id))', 'pode_editar_projeto(projeto_do_risco(risco_id))'),
      ('risco_gatilho_registro', 'pode_ver_projeto(projeto_do_gatilho(gatilho_id))', 'pode_editar_projeto(projeto_do_gatilho(gatilho_id))', 'pode_editar_projeto(projeto_do_gatilho(gatilho_id))'),
      ('risco_resposta', 'pode_ver_projeto(projeto_do_risco(risco_id))', 'pode_editar_projeto(projeto_do_risco(risco_id))', 'pode_editar_projeto(projeto_do_risco(risco_id))'),
      ('risco_stakeholder', 'pode_ver_projeto(projeto_do_risco(risco_id))', 'pode_editar_projeto(projeto_do_risco(risco_id))', 'pode_editar_projeto(projeto_do_risco(risco_id))')
    ) AS regras(tabela, ver, incluir, alterar)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tabela);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.tabela);
    EXECUTE format('CREATE POLICY crm_ver ON %I FOR SELECT TO crm_app USING (%s)', r.tabela, r.ver);
    IF r.incluir IS NOT NULL THEN
      EXECUTE format('CREATE POLICY crm_incluir ON %I FOR INSERT TO crm_app WITH CHECK (%s)', r.tabela, r.incluir);
    END IF;
    IF r.alterar IS NOT NULL THEN
      EXECUTE format('CREATE POLICY crm_alterar ON %I FOR UPDATE TO crm_app USING (%s) WITH CHECK (%s)', r.tabela, r.alterar, r.alterar);
    END IF;
  END LOOP;
END
$$;
--> statement-breakpoint

-- Permissões do papel da aplicação. Sem exclusão e sem alteração da estrutura.
GRANT USAGE ON SCHEMA public TO crm_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO crm_app;
--> statement-breakpoint
REVOKE INSERT, UPDATE ON registro_auditoria FROM crm_app;
--> statement-breakpoint

-- Colunas restritas (D-074, D4; P-054): a aplicação não as lê diretamente, só pelas funções
-- observacoes_da_pessoa e observacao_do_contato, que aplicam a regra.
REVOKE SELECT ON pessoa FROM crm_app;
--> statement-breakpoint
GRANT SELECT (id, tipo_stakeholder, nome_completo, nome_tratamento, nome_normalizado, criado_em, criado_por, atualizado_em, atualizado_por, arquivado_em)
  ON pessoa TO crm_app;
--> statement-breakpoint
REVOKE SELECT ON contato FROM crm_app;
--> statement-breakpoint
GRANT SELECT (id, stakeholder_id, vinculo_id, tipo, valor, valor_normalizado, natureza, principal, data_inicio, data_fim, criado_em, criado_por, atualizado_em, atualizado_por, arquivado_em)
  ON contato TO crm_app;
--> statement-breakpoint

-- Nas funções, só a aplicação executa. No Supabase, a API automática e a chave pública
-- também perdem qualquer acesso a este esquema (D-074): a autenticação não depende dele.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO crm_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint
DO $$
DECLARE
  v_papel text;
BEGIN
  FOREACH v_papel IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_papel) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', v_papel);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', v_papel);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', v_papel);
      EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', v_papel);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', v_papel);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', v_papel);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', v_papel);
    END IF;
  END LOOP;
END
$$;
