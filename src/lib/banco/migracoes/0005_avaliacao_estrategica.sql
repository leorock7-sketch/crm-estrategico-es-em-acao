CREATE TYPE "public"."dimensao_criterio" AS ENUM('poder', 'interesse');--> statement-breakpoint
CREATE TYPE "public"."grau_confianca" AS ENUM('alto', 'medio', 'baixo');--> statement-breakpoint
CREATE TYPE "public"."perfil_contexto" AS ENUM('gestor', 'colaborador', 'leitor');--> statement-breakpoint
CREATE TYPE "public"."posicionamento" AS ENUM('favoravel', 'parcialmente_favoravel', 'neutro', 'parcialmente_contrario', 'contrario');--> statement-breakpoint
CREATE TYPE "public"."situacao_metodologia" AS ENUM('rascunho', 'vigente', 'encerrada');--> statement-breakpoint
CREATE TYPE "public"."situacao_versao_avaliacao" AS ENUM('rascunho', 'vigente', 'substituida');--> statement-breakpoint
CREATE TYPE "public"."tipo_evidencia" AS ENUM('documento', 'link', 'observacao');--> statement-breakpoint
CREATE TABLE "avaliacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stakeholder_id" uuid NOT NULL,
	"projeto_tema_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "avaliacao_stakeholder_contexto_unica" UNIQUE("stakeholder_id","projeto_tema_id")
);
--> statement-breakpoint
CREATE TABLE "avaliacao_nota_criterio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"avaliacao_versao_id" uuid NOT NULL,
	"criterio_avaliacao_id" uuid NOT NULL,
	"nota" numeric(6, 2) NOT NULL,
	"justificativa" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "avaliacao_nota_criterio_unica" UNIQUE("avaliacao_versao_id","criterio_avaliacao_id")
);
--> statement-breakpoint
CREATE TABLE "avaliacao_versao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"avaliacao_id" uuid NOT NULL,
	"numero_versao" integer NOT NULL,
	"situacao" "situacao_versao_avaliacao" DEFAULT 'rascunho' NOT NULL,
	"metodologia_versao_id" uuid,
	"poder" numeric(6, 2),
	"interesse" numeric(6, 2),
	"posicionamento" "posicionamento",
	"grau_confianca" "grau_confianca",
	"justificativa_confianca" text,
	"justificativa" text,
	"validacao_institucional" text,
	"data_referencia" date,
	"proxima_revisao" date,
	"avaliador_id" uuid,
	"publicada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "avaliacao_versao_numero_unico" UNIQUE("avaliacao_id","numero_versao"),
	CONSTRAINT "avaliacao_versao_poder" CHECK ("avaliacao_versao"."poder" is null or ("avaliacao_versao"."poder" >= 0 and "avaliacao_versao"."poder" <= 100)),
	CONSTRAINT "avaliacao_versao_interesse" CHECK ("avaliacao_versao"."interesse" is null or ("avaliacao_versao"."interesse" >= 0 and "avaliacao_versao"."interesse" <= 100))
);
--> statement-breakpoint
CREATE TABLE "criterio_avaliacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metodologia_versao_id" uuid NOT NULL,
	"dimensao" "dimensao_criterio" NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"escala_minima" integer NOT NULL,
	"escala_maxima" integer NOT NULL,
	"peso" numeric(8, 4),
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "criterio_avaliacao_nome_unico" UNIQUE("metodologia_versao_id","dimensao","nome"),
	CONSTRAINT "criterio_avaliacao_escala" CHECK ("criterio_avaliacao"."escala_maxima" > "criterio_avaliacao"."escala_minima"),
	CONSTRAINT "criterio_avaliacao_peso" CHECK ("criterio_avaliacao"."peso" is null or "criterio_avaliacao"."peso" >= 0)
);
--> statement-breakpoint
CREATE TABLE "evidencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"avaliacao_versao_id" uuid NOT NULL,
	"tipo" "tipo_evidencia" NOT NULL,
	"descricao" text NOT NULL,
	"fonte" text,
	"url" text,
	"data_evidencia" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "evidencia_descricao_preenchida" CHECK (length(trim("evidencia"."descricao")) > 0)
);
--> statement-breakpoint
CREATE TABLE "metodologia_versao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"situacao" "situacao_metodologia" DEFAULT 'rascunho' NOT NULL,
	"homologada" boolean DEFAULT false NOT NULL,
	"vigente_desde" date,
	"vigente_ate" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "metodologia_versao_nome_unico" UNIQUE("nome"),
	CONSTRAINT "metodologia_versao_datas" CHECK ("metodologia_versao"."vigente_desde" is null or "metodologia_versao"."vigente_ate" is null or "metodologia_versao"."vigente_ate" >= "metodologia_versao"."vigente_desde")
);
--> statement-breakpoint
CREATE TABLE "permissao_contexto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"projeto_tema_id" uuid NOT NULL,
	"perfil" "perfil_contexto" NOT NULL,
	"valida_ate" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_stakeholder_id_stakeholder_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_projeto_tema_id_projeto_tema_id_fk" FOREIGN KEY ("projeto_tema_id") REFERENCES "public"."projeto_tema"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao_nota_criterio" ADD CONSTRAINT "avaliacao_nota_criterio_avaliacao_versao_id_avaliacao_versao_id_fk" FOREIGN KEY ("avaliacao_versao_id") REFERENCES "public"."avaliacao_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao_nota_criterio" ADD CONSTRAINT "avaliacao_nota_criterio_criterio_avaliacao_id_criterio_avaliacao_id_fk" FOREIGN KEY ("criterio_avaliacao_id") REFERENCES "public"."criterio_avaliacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao_nota_criterio" ADD CONSTRAINT "avaliacao_nota_criterio_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao_nota_criterio" ADD CONSTRAINT "avaliacao_nota_criterio_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD CONSTRAINT "avaliacao_versao_avaliacao_id_avaliacao_id_fk" FOREIGN KEY ("avaliacao_id") REFERENCES "public"."avaliacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD CONSTRAINT "avaliacao_versao_metodologia_versao_id_metodologia_versao_id_fk" FOREIGN KEY ("metodologia_versao_id") REFERENCES "public"."metodologia_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD CONSTRAINT "avaliacao_versao_avaliador_id_usuario_id_fk" FOREIGN KEY ("avaliador_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD CONSTRAINT "avaliacao_versao_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD CONSTRAINT "avaliacao_versao_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterio_avaliacao" ADD CONSTRAINT "criterio_avaliacao_metodologia_versao_id_metodologia_versao_id_fk" FOREIGN KEY ("metodologia_versao_id") REFERENCES "public"."metodologia_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterio_avaliacao" ADD CONSTRAINT "criterio_avaliacao_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterio_avaliacao" ADD CONSTRAINT "criterio_avaliacao_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_avaliacao_versao_id_avaliacao_versao_id_fk" FOREIGN KEY ("avaliacao_versao_id") REFERENCES "public"."avaliacao_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodologia_versao" ADD CONSTRAINT "metodologia_versao_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodologia_versao" ADD CONSTRAINT "metodologia_versao_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissao_contexto" ADD CONSTRAINT "permissao_contexto_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissao_contexto" ADD CONSTRAINT "permissao_contexto_projeto_tema_id_projeto_tema_id_fk" FOREIGN KEY ("projeto_tema_id") REFERENCES "public"."projeto_tema"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissao_contexto" ADD CONSTRAINT "permissao_contexto_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissao_contexto" ADD CONSTRAINT "permissao_contexto_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "avaliacao_projeto_idx" ON "avaliacao" USING btree ("projeto_tema_id");--> statement-breakpoint
CREATE UNIQUE INDEX "avaliacao_versao_vigente_unica" ON "avaliacao_versao" USING btree ("avaliacao_id") WHERE "avaliacao_versao"."situacao" = 'vigente';--> statement-breakpoint
CREATE UNIQUE INDEX "avaliacao_versao_rascunho_unico" ON "avaliacao_versao" USING btree ("avaliacao_id") WHERE "avaliacao_versao"."situacao" = 'rascunho' and "avaliacao_versao"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "evidencia_versao_idx" ON "evidencia" USING btree ("avaliacao_versao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metodologia_vigente_unica" ON "metodologia_versao" USING btree ("situacao") WHERE "metodologia_versao"."situacao" = 'vigente';--> statement-breakpoint
CREATE UNIQUE INDEX "permissao_contexto_unica" ON "permissao_contexto" USING btree ("usuario_id","projeto_tema_id") WHERE "permissao_contexto"."arquivado_em" is null;--> statement-breakpoint

-- Gatilhos comuns (funções criadas em 0001_gatilhos.sql).
CREATE TRIGGER metodologia_versao_controle BEFORE INSERT OR UPDATE ON metodologia_versao
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER metodologia_versao_auditoria AFTER INSERT OR UPDATE OR DELETE ON metodologia_versao
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER metodologia_versao_sem_exclusao BEFORE DELETE ON metodologia_versao
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER criterio_avaliacao_controle BEFORE INSERT OR UPDATE ON criterio_avaliacao
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER criterio_avaliacao_auditoria AFTER INSERT OR UPDATE OR DELETE ON criterio_avaliacao
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER criterio_avaliacao_sem_exclusao BEFORE DELETE ON criterio_avaliacao
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER avaliacao_controle BEFORE INSERT OR UPDATE ON avaliacao
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER avaliacao_auditoria AFTER INSERT OR UPDATE OR DELETE ON avaliacao
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER avaliacao_sem_exclusao BEFORE DELETE ON avaliacao
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER avaliacao_versao_controle BEFORE INSERT OR UPDATE ON avaliacao_versao
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER avaliacao_versao_auditoria AFTER INSERT OR UPDATE OR DELETE ON avaliacao_versao
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER avaliacao_versao_sem_exclusao BEFORE DELETE ON avaliacao_versao
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER avaliacao_nota_criterio_controle BEFORE INSERT OR UPDATE ON avaliacao_nota_criterio
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER avaliacao_nota_criterio_auditoria AFTER INSERT OR UPDATE OR DELETE ON avaliacao_nota_criterio
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER avaliacao_nota_criterio_sem_exclusao BEFORE DELETE ON avaliacao_nota_criterio
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER evidencia_controle BEFORE INSERT OR UPDATE ON evidencia
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER evidencia_auditoria AFTER INSERT OR UPDATE OR DELETE ON evidencia
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER evidencia_sem_exclusao BEFORE DELETE ON evidencia
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER permissao_contexto_controle BEFORE INSERT OR UPDATE ON permissao_contexto
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER permissao_contexto_auditoria AFTER INSERT OR UPDATE OR DELETE ON permissao_contexto
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER permissao_contexto_sem_exclusao BEFORE DELETE ON permissao_contexto
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint

-- Metodologia: nasce como rascunho; só entra em vigor com critérios de poder e
-- de interesse; vigente, só pode ser encerrada; encerrada, não muda mais.
CREATE FUNCTION proteger_metodologia() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.situacao <> 'rascunho' THEN
      RAISE EXCEPTION 'Toda metodologia nasce como rascunho.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.situacao = 'encerrada' THEN
    IF (to_jsonb(OLD) - 'atualizado_em' - 'atualizado_por')
       <> (to_jsonb(NEW) - 'atualizado_em' - 'atualizado_por') THEN
      RAISE EXCEPTION 'Uma metodologia encerrada não pode ser alterada.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF OLD.situacao = 'vigente' THEN
    IF NEW.situacao = 'rascunho'
       OR (to_jsonb(OLD) - 'atualizado_em' - 'atualizado_por' - 'situacao' - 'vigente_ate')
          <> (to_jsonb(NEW) - 'atualizado_em' - 'atualizado_por' - 'situacao' - 'vigente_ate') THEN
      RAISE EXCEPTION 'Uma metodologia vigente não pode ser alterada; crie uma nova versão.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.situacao = 'encerrada' THEN
      NEW.vigente_ate := coalesce(NEW.vigente_ate, current_date);
    END IF;
  ELSIF NEW.situacao = 'encerrada' THEN
    RAISE EXCEPTION 'Uma metodologia em rascunho não pode ser encerrada; ela ainda não entrou em vigor.' USING ERRCODE = 'P0001';
  ELSIF NEW.situacao = 'vigente' THEN
    IF NOT EXISTS (SELECT 1 FROM criterio_avaliacao WHERE metodologia_versao_id = NEW.id AND dimensao = 'poder' AND arquivado_em IS NULL)
       OR NOT EXISTS (SELECT 1 FROM criterio_avaliacao WHERE metodologia_versao_id = NEW.id AND dimensao = 'interesse' AND arquivado_em IS NULL) THEN
      RAISE EXCEPTION 'A metodologia precisa de pelo menos um critério de poder e um de interesse para entrar em vigor.' USING ERRCODE = 'P0001';
    END IF;
    NEW.vigente_desde := coalesce(NEW.vigente_desde, current_date);
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER metodologia_versao_protegida BEFORE INSERT OR UPDATE ON metodologia_versao
  FOR EACH ROW EXECUTE FUNCTION proteger_metodologia();
--> statement-breakpoint

-- Critérios só podem ser incluídos ou alterados enquanto a metodologia for rascunho.
CREATE FUNCTION proteger_criterio() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT situacao FROM metodologia_versao WHERE id = NEW.metodologia_versao_id) <> 'rascunho'
     OR (TG_OP = 'UPDATE' AND (SELECT situacao FROM metodologia_versao WHERE id = OLD.metodologia_versao_id) <> 'rascunho') THEN
    RAISE EXCEPTION 'Os critérios de uma metodologia vigente ou encerrada não podem ser alterados; crie uma nova versão da metodologia.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER criterio_avaliacao_protegido BEFORE INSERT OR UPDATE ON criterio_avaliacao
  FOR EACH ROW EXECUTE FUNCTION proteger_criterio();
--> statement-breakpoint

-- A ficha exige que o stakeholder esteja associado ao contexto e não muda de dono.
CREATE FUNCTION verificar_ficha_avaliacao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.stakeholder_id <> OLD.stakeholder_id OR NEW.projeto_tema_id <> OLD.projeto_tema_id THEN
      RAISE EXCEPTION 'A ficha de avaliação não pode mudar de stakeholder nem de projeto ou tema.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM stakeholder_contexto
    WHERE stakeholder_id = NEW.stakeholder_id AND projeto_tema_id = NEW.projeto_tema_id
      AND data_fim IS NULL AND arquivado_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Associe a pessoa ou instituição ao projeto ou tema antes de avaliá-la.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER avaliacao_valida BEFORE INSERT OR UPDATE ON avaliacao
  FOR EACH ROW EXECUTE FUNCTION verificar_ficha_avaliacao();
--> statement-breakpoint

-- Versão de avaliação: nasce como rascunho; a publicação exige justificativa,
-- data de referência e evidência; publicada, só pode passar a "substituída".
CREATE FUNCTION proteger_versao_avaliacao() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_tipo tipo_stakeholder;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.situacao <> 'rascunho' THEN
      RAISE EXCEPTION 'Toda versão de avaliação nasce como rascunho.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.metodologia_versao_id IS NOT NULL
       AND (SELECT situacao FROM metodologia_versao WHERE id = NEW.metodologia_versao_id) <> 'vigente' THEN
      RAISE EXCEPTION 'Novas avaliações só podem usar a metodologia vigente.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.avaliacao_id <> OLD.avaliacao_id OR NEW.numero_versao <> OLD.numero_versao THEN
    RAISE EXCEPTION 'A versão não pode mudar de ficha nem de número.' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.situacao IN ('vigente', 'substituida') THEN
    IF NOT (OLD.situacao = 'vigente' AND NEW.situacao = 'substituida')
       OR (to_jsonb(OLD) - 'atualizado_em' - 'atualizado_por' - 'situacao')
          <> (to_jsonb(NEW) - 'atualizado_em' - 'atualizado_por' - 'situacao') THEN
      RAISE EXCEPTION 'Versões publicadas não podem ser alteradas; registre uma nova versão.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- Rascunho.
  IF NEW.situacao = 'substituida' THEN
    RAISE EXCEPTION 'Um rascunho não pode ser marcado como substituído.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.situacao = 'vigente' THEN
    IF OLD.arquivado_em IS NOT NULL OR NEW.arquivado_em IS NOT NULL THEN
      RAISE EXCEPTION 'Um rascunho descartado não pode ser publicado.' USING ERRCODE = 'P0001';
    END IF;
    IF coalesce(length(trim(NEW.justificativa)), 0) = 0 THEN
      RAISE EXCEPTION 'Informe a justificativa antes de publicar.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.data_referencia IS NULL THEN
      RAISE EXCEPTION 'Informe a data de referência antes de publicar.' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM evidencia WHERE avaliacao_versao_id = NEW.id AND arquivado_em IS NULL) THEN
      RAISE EXCEPTION 'Registre pelo menos uma evidência antes de publicar.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.grau_confianca IS NOT NULL AND coalesce(length(trim(NEW.justificativa_confianca)), 0) = 0 THEN
      RAISE EXCEPTION 'Justifique o grau de confiança escolhido.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.metodologia_versao_id IS NOT NULL
       AND (SELECT situacao FROM metodologia_versao WHERE id = NEW.metodologia_versao_id) <> 'vigente' THEN
      RAISE EXCEPTION 'A metodologia deste rascunho não está mais vigente. Descarte-o e inicie uma nova avaliação.'
        USING ERRCODE = 'P0001';
    END IF;
    SELECT s.tipo INTO v_tipo
    FROM avaliacao a JOIN stakeholder s ON s.id = a.stakeholder_id
    WHERE a.id = NEW.avaliacao_id;
    IF v_tipo = 'instituicao' AND NEW.posicionamento IS NOT NULL
       AND coalesce(length(trim(NEW.validacao_institucional)), 0) = 0 THEN
      RAISE EXCEPTION 'Para atribuir posicionamento a uma instituição, informe a validação institucional (fonte e justificativa).'
        USING ERRCODE = 'P0001';
    END IF;
    NEW.publicada_em := now();
    NEW.avaliador_id := coalesce(NEW.avaliador_id, usuario_da_sessao());
    NEW.proxima_revisao := (NEW.data_referencia + interval '1 year')::date;
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER avaliacao_versao_protegida BEFORE INSERT OR UPDATE ON avaliacao_versao
  FOR EACH ROW EXECUTE FUNCTION proteger_versao_avaliacao();
--> statement-breakpoint

-- Notas e evidências só mudam enquanto a versão é um rascunho ativo.
CREATE FUNCTION proteger_item_da_versao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.avaliacao_versao_id <> OLD.avaliacao_versao_id THEN
    RAISE EXCEPTION 'O item não pode mudar de versão de avaliação.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM avaliacao_versao
    WHERE id = NEW.avaliacao_versao_id AND situacao = 'rascunho' AND arquivado_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Versões publicadas não podem ser alteradas; registre uma nova versão.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER avaliacao_nota_criterio_protegida BEFORE INSERT OR UPDATE ON avaliacao_nota_criterio
  FOR EACH ROW EXECUTE FUNCTION proteger_item_da_versao();
--> statement-breakpoint
CREATE TRIGGER evidencia_protegida BEFORE INSERT OR UPDATE ON evidencia
  FOR EACH ROW EXECUTE FUNCTION proteger_item_da_versao();
--> statement-breakpoint

-- A nota deve ser de um critério da mesma metodologia e respeitar a escala.
CREATE FUNCTION verificar_nota_criterio() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_metodologia uuid;
  v_minima integer;
  v_maxima integer;
BEGIN
  SELECT metodologia_versao_id, escala_minima, escala_maxima INTO v_metodologia, v_minima, v_maxima
  FROM criterio_avaliacao WHERE id = NEW.criterio_avaliacao_id;
  IF v_metodologia IS DISTINCT FROM (SELECT metodologia_versao_id FROM avaliacao_versao WHERE id = NEW.avaliacao_versao_id) THEN
    RAISE EXCEPTION 'O critério não pertence à metodologia desta avaliação.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.nota < v_minima OR NEW.nota > v_maxima THEN
    RAISE EXCEPTION 'A nota deve estar entre % e %.', v_minima, v_maxima USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER avaliacao_nota_criterio_valida BEFORE INSERT OR UPDATE ON avaliacao_nota_criterio
  FOR EACH ROW EXECUTE FUNCTION verificar_nota_criterio();
