-- Gatilhos e funções do banco (Etapa 1).
-- Cada comando é separado por "statement-breakpoint", exigido pelo migrador.
--
-- O usuário responsável por cada operação é informado pela aplicação, dentro
-- da transação, com: select set_config('app.usuario_id', '<uuid>', true)

-- Usuário da operação em andamento (nulo quando não informado, por exemplo em cargas iniciais).
CREATE FUNCTION usuario_da_sessao() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.usuario_id', true), '')::uuid
$$;
--> statement-breakpoint

-- Preenche automaticamente quem criou, quem alterou e quando.
CREATE FUNCTION preencher_controle() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.criado_por := coalesce(NEW.criado_por, usuario_da_sessao());
    NEW.atualizado_por := coalesce(NEW.atualizado_por, NEW.criado_por);
  ELSE
    NEW.criado_em := OLD.criado_em;
    NEW.criado_por := OLD.criado_por;
    NEW.atualizado_em := now();
    NEW.atualizado_por := usuario_da_sessao();
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

CREATE FUNCTION preencher_criador() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.criado_por := coalesce(NEW.criado_por, usuario_da_sessao());
  RETURN NEW;
END
$$;
--> statement-breakpoint

-- Registra inclusões, alterações, arquivamentos e reativações na trilha de auditoria.
CREATE FUNCTION registrar_auditoria() RETURNS trigger
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
    IF OLD.arquivado_em IS NULL AND NEW.arquivado_em IS NOT NULL THEN
      v_operacao := 'arquivamento';
    ELSIF OLD.arquivado_em IS NOT NULL AND NEW.arquivado_em IS NULL THEN
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

-- Registros não são apagados: são arquivados, preservando o histórico.
CREATE FUNCTION impedir_exclusao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Registros de % não são excluídos; utilize o arquivamento.', TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END
$$;
--> statement-breakpoint

-- A trilha de auditoria não pode ser alterada nem apagada.
CREATE FUNCTION impedir_alteracao_auditoria() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'O registro de auditoria não pode ser alterado nem excluído.'
    USING ERRCODE = 'P0001';
END
$$;
--> statement-breakpoint

-- Comitê temático deve estar subordinado a um comitê do tipo "desenvolvimento".
CREATE FUNCTION verificar_comite_superior() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.comite_superior_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM comite WHERE id = NEW.comite_superior_id AND tipo = 'desenvolvimento'
  ) THEN
    RAISE EXCEPTION 'Um comitê temático deve estar subordinado a um comitê de desenvolvimento.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

-- A hierarquia de instituições não pode formar ciclo (A → B → A).
CREATE FUNCTION verificar_ciclo_instituicao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.instituicao_superior_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE cadeia(id) AS (
      SELECT NEW.instituicao_superior_id
      UNION
      SELECT i.instituicao_superior_id
      FROM instituicao i
      JOIN cadeia c ON i.id = c.id
      WHERE i.instituicao_superior_id IS NOT NULL
    )
    SELECT 1 FROM cadeia WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'A hierarquia de instituições não pode formar um ciclo.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

-- O tipo de um stakeholder (pessoa ou instituição) não muda depois de criado.
CREATE FUNCTION impedir_troca_tipo_stakeholder() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
    RAISE EXCEPTION 'O tipo do stakeholder não pode ser alterado.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

-- Aplicação dos gatilhos -------------------------------------------------------

CREATE TRIGGER comite_controle BEFORE INSERT OR UPDATE ON comite
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER projeto_tema_controle BEFORE INSERT OR UPDATE ON projeto_tema
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER pessoa_controle BEFORE INSERT OR UPDATE ON pessoa
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER instituicao_controle BEFORE INSERT OR UPDATE ON instituicao
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER vinculo_controle BEFORE INSERT OR UPDATE ON vinculo_pessoa_instituicao
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER stakeholder_criador BEFORE INSERT ON stakeholder
  FOR EACH ROW EXECUTE FUNCTION preencher_criador();
--> statement-breakpoint

CREATE TRIGGER comite_auditoria AFTER INSERT OR UPDATE OR DELETE ON comite
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER projeto_tema_auditoria AFTER INSERT OR UPDATE OR DELETE ON projeto_tema
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER pessoa_auditoria AFTER INSERT OR UPDATE OR DELETE ON pessoa
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER instituicao_auditoria AFTER INSERT OR UPDATE OR DELETE ON instituicao
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER vinculo_auditoria AFTER INSERT OR UPDATE OR DELETE ON vinculo_pessoa_instituicao
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint

CREATE TRIGGER comite_sem_exclusao BEFORE DELETE ON comite
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER projeto_tema_sem_exclusao BEFORE DELETE ON projeto_tema
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER stakeholder_sem_exclusao BEFORE DELETE ON stakeholder
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER pessoa_sem_exclusao BEFORE DELETE ON pessoa
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER instituicao_sem_exclusao BEFORE DELETE ON instituicao
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER vinculo_sem_exclusao BEFORE DELETE ON vinculo_pessoa_instituicao
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint

CREATE TRIGGER registro_auditoria_imutavel BEFORE UPDATE OR DELETE ON registro_auditoria
  FOR EACH ROW EXECUTE FUNCTION impedir_alteracao_auditoria();
--> statement-breakpoint

CREATE TRIGGER comite_superior_valido BEFORE INSERT OR UPDATE ON comite
  FOR EACH ROW EXECUTE FUNCTION verificar_comite_superior();
--> statement-breakpoint
CREATE TRIGGER instituicao_sem_ciclo BEFORE INSERT OR UPDATE ON instituicao
  FOR EACH ROW EXECUTE FUNCTION verificar_ciclo_instituicao();
--> statement-breakpoint
CREATE TRIGGER stakeholder_tipo_fixo BEFORE UPDATE ON stakeholder
  FOR EACH ROW EXECUTE FUNCTION impedir_troca_tipo_stakeholder();
