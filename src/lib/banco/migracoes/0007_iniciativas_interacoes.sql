-- Etapa 3 (D-070): iniciativas, interações e compromissos. Somente acréscimos:
-- nenhuma tabela existente é alterada. Gerado pelo drizzle-kit e completado
-- manualmente com os gatilhos ao final.
CREATE TYPE "public"."papel_iniciativa" AS ENUM('demandante', 'apoiador', 'decisor', 'executor', 'afetado', 'outro');--> statement-breakpoint
CREATE TYPE "public"."presenca_interacao" AS ENUM('convidado', 'presente', 'ausente');--> statement-breakpoint
CREATE TYPE "public"."prioridade_iniciativa" AS ENUM('alta', 'media', 'baixa');--> statement-breakpoint
CREATE TYPE "public"."situacao_compromisso" AS ENUM('aberto', 'em_andamento', 'concluido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."situacao_iniciativa" AS ENUM('registrada', 'em_analise', 'em_andamento', 'suspensa', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."situacao_interacao" AS ENUM('agendada', 'realizada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."tipo_iniciativa" AS ENUM('demanda', 'reuniao_relevante', 'frente_atuacao');--> statement-breakpoint
CREATE TYPE "public"."tipo_interacao" AS ENUM('reuniao_presencial', 'reuniao_virtual', 'ligacao', 'email', 'evento', 'visita', 'outro');--> statement-breakpoint
CREATE TABLE "compromisso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"descricao" text NOT NULL,
	"interacao_id" uuid,
	"iniciativa_id" uuid,
	"responsavel_usuario_id" uuid,
	"responsavel_stakeholder_id" uuid,
	"prazo" date,
	"situacao" "situacao_compromisso" DEFAULT 'aberto' NOT NULL,
	"concluido_em" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "compromisso_descricao_preenchida" CHECK (length(trim("compromisso"."descricao")) > 0),
	CONSTRAINT "compromisso_com_origem" CHECK ("compromisso"."interacao_id" is not null or "compromisso"."iniciativa_id" is not null),
	CONSTRAINT "compromisso_com_responsavel" CHECK ("compromisso"."responsavel_usuario_id" is not null or "compromisso"."responsavel_stakeholder_id" is not null),
	CONSTRAINT "compromisso_concluido_com_data" CHECK ("compromisso"."situacao" <> 'concluido' or "compromisso"."concluido_em" is not null)
);
--> statement-breakpoint
CREATE TABLE "compromisso_acompanhamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compromisso_id" uuid NOT NULL,
	"data" date NOT NULL,
	"registro" text NOT NULL,
	"situacao" "situacao_compromisso",
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "compromisso_acompanhamento_registro_preenchido" CHECK (length(trim("compromisso_acompanhamento"."registro")) > 0)
);
--> statement-breakpoint
CREATE TABLE "iniciativa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_iniciativa" NOT NULL,
	"titulo" text NOT NULL,
	"titulo_normalizado" text NOT NULL,
	"descricao" text,
	"origem" text,
	"situacao" "situacao_iniciativa" DEFAULT 'registrada' NOT NULL,
	"prioridade" "prioridade_iniciativa",
	"responsavel_id" uuid,
	"data_abertura" date NOT NULL,
	"data_prevista_conclusao" date,
	"data_conclusao" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "iniciativa_titulo_preenchido" CHECK (length(trim("iniciativa"."titulo")) > 0),
	CONSTRAINT "iniciativa_datas" CHECK (("iniciativa"."data_conclusao" is null or "iniciativa"."data_conclusao" >= "iniciativa"."data_abertura") and ("iniciativa"."data_prevista_conclusao" is null or "iniciativa"."data_prevista_conclusao" >= "iniciativa"."data_abertura")),
	CONSTRAINT "iniciativa_concluida_com_data" CHECK ("iniciativa"."situacao" <> 'concluida' or "iniciativa"."data_conclusao" is not null)
);
--> statement-breakpoint
CREATE TABLE "iniciativa_projeto_tema" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iniciativa_id" uuid NOT NULL,
	"projeto_tema_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "iniciativa_stakeholder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iniciativa_id" uuid NOT NULL,
	"stakeholder_id" uuid NOT NULL,
	"papel" "papel_iniciativa" NOT NULL,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_interacao" NOT NULL,
	"assunto" text NOT NULL,
	"assunto_normalizado" text NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone,
	"local" text,
	"resumo" text,
	"situacao" "situacao_interacao" DEFAULT 'realizada' NOT NULL,
	"origem_sistema" text,
	"origem_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "interacao_assunto_preenchido" CHECK (length(trim("interacao"."assunto")) > 0),
	CONSTRAINT "interacao_periodo" CHECK ("interacao"."fim" is null or "interacao"."fim" >= "interacao"."inicio"),
	CONSTRAINT "interacao_origem_completa" CHECK (("interacao"."origem_sistema" is null) = ("interacao"."origem_id" is null))
);
--> statement-breakpoint
CREATE TABLE "interacao_iniciativa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interacao_id" uuid NOT NULL,
	"iniciativa_id" uuid NOT NULL,
	"contribuicao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interacao_participante" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interacao_id" uuid NOT NULL,
	"stakeholder_id" uuid,
	"usuario_id" uuid,
	"presenca" "presenca_interacao" DEFAULT 'presente' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "interacao_participante_um_tipo" CHECK (("interacao_participante"."stakeholder_id" is null) <> ("interacao_participante"."usuario_id" is null))
);
--> statement-breakpoint
CREATE TABLE "interacao_projeto_tema" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interacao_id" uuid NOT NULL,
	"projeto_tema_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_interacao_id_interacao_id_fk" FOREIGN KEY ("interacao_id") REFERENCES "public"."interacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_iniciativa_id_iniciativa_id_fk" FOREIGN KEY ("iniciativa_id") REFERENCES "public"."iniciativa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_responsavel_usuario_id_usuario_id_fk" FOREIGN KEY ("responsavel_usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_responsavel_stakeholder_id_stakeholder_id_fk" FOREIGN KEY ("responsavel_stakeholder_id") REFERENCES "public"."stakeholder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compromisso_acompanhamento" ADD CONSTRAINT "compromisso_acompanhamento_compromisso_id_compromisso_id_fk" FOREIGN KEY ("compromisso_id") REFERENCES "public"."compromisso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compromisso_acompanhamento" ADD CONSTRAINT "compromisso_acompanhamento_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compromisso_acompanhamento" ADD CONSTRAINT "compromisso_acompanhamento_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iniciativa" ADD CONSTRAINT "iniciativa_responsavel_id_usuario_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iniciativa" ADD CONSTRAINT "iniciativa_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iniciativa" ADD CONSTRAINT "iniciativa_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iniciativa_projeto_tema" ADD CONSTRAINT "iniciativa_projeto_tema_iniciativa_id_iniciativa_id_fk" FOREIGN KEY ("iniciativa_id") REFERENCES "public"."iniciativa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iniciativa_projeto_tema" ADD CONSTRAINT "iniciativa_projeto_tema_projeto_tema_id_projeto_tema_id_fk" FOREIGN KEY ("projeto_tema_id") REFERENCES "public"."projeto_tema"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iniciativa_projeto_tema" ADD CONSTRAINT "iniciativa_projeto_tema_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iniciativa_projeto_tema" ADD CONSTRAINT "iniciativa_projeto_tema_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iniciativa_stakeholder" ADD CONSTRAINT "iniciativa_stakeholder_iniciativa_id_iniciativa_id_fk" FOREIGN KEY ("iniciativa_id") REFERENCES "public"."iniciativa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iniciativa_stakeholder" ADD CONSTRAINT "iniciativa_stakeholder_stakeholder_id_stakeholder_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iniciativa_stakeholder" ADD CONSTRAINT "iniciativa_stakeholder_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iniciativa_stakeholder" ADD CONSTRAINT "iniciativa_stakeholder_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao" ADD CONSTRAINT "interacao_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao" ADD CONSTRAINT "interacao_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao_iniciativa" ADD CONSTRAINT "interacao_iniciativa_interacao_id_interacao_id_fk" FOREIGN KEY ("interacao_id") REFERENCES "public"."interacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao_iniciativa" ADD CONSTRAINT "interacao_iniciativa_iniciativa_id_iniciativa_id_fk" FOREIGN KEY ("iniciativa_id") REFERENCES "public"."iniciativa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao_iniciativa" ADD CONSTRAINT "interacao_iniciativa_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao_iniciativa" ADD CONSTRAINT "interacao_iniciativa_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao_participante" ADD CONSTRAINT "interacao_participante_interacao_id_interacao_id_fk" FOREIGN KEY ("interacao_id") REFERENCES "public"."interacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao_participante" ADD CONSTRAINT "interacao_participante_stakeholder_id_stakeholder_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao_participante" ADD CONSTRAINT "interacao_participante_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao_participante" ADD CONSTRAINT "interacao_participante_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao_participante" ADD CONSTRAINT "interacao_participante_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao_projeto_tema" ADD CONSTRAINT "interacao_projeto_tema_interacao_id_interacao_id_fk" FOREIGN KEY ("interacao_id") REFERENCES "public"."interacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao_projeto_tema" ADD CONSTRAINT "interacao_projeto_tema_projeto_tema_id_projeto_tema_id_fk" FOREIGN KEY ("projeto_tema_id") REFERENCES "public"."projeto_tema"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao_projeto_tema" ADD CONSTRAINT "interacao_projeto_tema_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interacao_projeto_tema" ADD CONSTRAINT "interacao_projeto_tema_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compromisso_interacao_idx" ON "compromisso" USING btree ("interacao_id");--> statement-breakpoint
CREATE INDEX "compromisso_iniciativa_idx" ON "compromisso" USING btree ("iniciativa_id");--> statement-breakpoint
CREATE INDEX "compromisso_prazo_idx" ON "compromisso" USING btree ("prazo");--> statement-breakpoint
CREATE INDEX "compromisso_acompanhamento_compromisso_idx" ON "compromisso_acompanhamento" USING btree ("compromisso_id");--> statement-breakpoint
CREATE INDEX "iniciativa_titulo_normalizado_idx" ON "iniciativa" USING btree ("titulo_normalizado");--> statement-breakpoint
CREATE INDEX "iniciativa_responsavel_idx" ON "iniciativa" USING btree ("responsavel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "iniciativa_projeto_tema_unico" ON "iniciativa_projeto_tema" USING btree ("iniciativa_id","projeto_tema_id") WHERE "iniciativa_projeto_tema"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "iniciativa_projeto_tema_projeto_idx" ON "iniciativa_projeto_tema" USING btree ("projeto_tema_id");--> statement-breakpoint
CREATE UNIQUE INDEX "iniciativa_stakeholder_unico" ON "iniciativa_stakeholder" USING btree ("iniciativa_id","stakeholder_id","papel") WHERE "iniciativa_stakeholder"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "iniciativa_stakeholder_stakeholder_idx" ON "iniciativa_stakeholder" USING btree ("stakeholder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interacao_origem_unica" ON "interacao" USING btree ("origem_sistema","origem_id") WHERE "interacao"."origem_sistema" is not null;--> statement-breakpoint
CREATE INDEX "interacao_inicio_idx" ON "interacao" USING btree ("inicio");--> statement-breakpoint
CREATE INDEX "interacao_assunto_normalizado_idx" ON "interacao" USING btree ("assunto_normalizado");--> statement-breakpoint
CREATE UNIQUE INDEX "interacao_iniciativa_unico" ON "interacao_iniciativa" USING btree ("interacao_id","iniciativa_id") WHERE "interacao_iniciativa"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "interacao_iniciativa_iniciativa_idx" ON "interacao_iniciativa" USING btree ("iniciativa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interacao_participante_stakeholder_unico" ON "interacao_participante" USING btree ("interacao_id","stakeholder_id") WHERE "interacao_participante"."stakeholder_id" is not null and "interacao_participante"."arquivado_em" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "interacao_participante_usuario_unico" ON "interacao_participante" USING btree ("interacao_id","usuario_id") WHERE "interacao_participante"."usuario_id" is not null and "interacao_participante"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "interacao_participante_stakeholder_idx" ON "interacao_participante" USING btree ("stakeholder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interacao_projeto_tema_unico" ON "interacao_projeto_tema" USING btree ("interacao_id","projeto_tema_id") WHERE "interacao_projeto_tema"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "interacao_projeto_tema_projeto_idx" ON "interacao_projeto_tema" USING btree ("projeto_tema_id");--> statement-breakpoint

-- Etapa 3: gatilhos comuns (funções criadas em 0001_gatilhos.sql): quem e quando,
-- trilha de auditoria e proibição de excluir (retirar é arquivar).
CREATE TRIGGER iniciativa_controle BEFORE INSERT OR UPDATE ON iniciativa
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER iniciativa_auditoria AFTER INSERT OR UPDATE OR DELETE ON iniciativa
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER iniciativa_sem_exclusao BEFORE DELETE ON iniciativa
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER iniciativa_projeto_tema_controle BEFORE INSERT OR UPDATE ON iniciativa_projeto_tema
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER iniciativa_projeto_tema_auditoria AFTER INSERT OR UPDATE OR DELETE ON iniciativa_projeto_tema
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER iniciativa_projeto_tema_sem_exclusao BEFORE DELETE ON iniciativa_projeto_tema
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER iniciativa_stakeholder_controle BEFORE INSERT OR UPDATE ON iniciativa_stakeholder
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER iniciativa_stakeholder_auditoria AFTER INSERT OR UPDATE OR DELETE ON iniciativa_stakeholder
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER iniciativa_stakeholder_sem_exclusao BEFORE DELETE ON iniciativa_stakeholder
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER interacao_controle BEFORE INSERT OR UPDATE ON interacao
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER interacao_auditoria AFTER INSERT OR UPDATE OR DELETE ON interacao
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER interacao_sem_exclusao BEFORE DELETE ON interacao
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER interacao_participante_controle BEFORE INSERT OR UPDATE ON interacao_participante
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER interacao_participante_auditoria AFTER INSERT OR UPDATE OR DELETE ON interacao_participante
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER interacao_participante_sem_exclusao BEFORE DELETE ON interacao_participante
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER interacao_projeto_tema_controle BEFORE INSERT OR UPDATE ON interacao_projeto_tema
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER interacao_projeto_tema_auditoria AFTER INSERT OR UPDATE OR DELETE ON interacao_projeto_tema
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER interacao_projeto_tema_sem_exclusao BEFORE DELETE ON interacao_projeto_tema
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER interacao_iniciativa_controle BEFORE INSERT OR UPDATE ON interacao_iniciativa
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER interacao_iniciativa_auditoria AFTER INSERT OR UPDATE OR DELETE ON interacao_iniciativa
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER interacao_iniciativa_sem_exclusao BEFORE DELETE ON interacao_iniciativa
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER compromisso_controle BEFORE INSERT OR UPDATE ON compromisso
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER compromisso_auditoria AFTER INSERT OR UPDATE OR DELETE ON compromisso
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER compromisso_sem_exclusao BEFORE DELETE ON compromisso
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER compromisso_acompanhamento_controle BEFORE INSERT OR UPDATE ON compromisso_acompanhamento
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER compromisso_acompanhamento_auditoria AFTER INSERT OR UPDATE OR DELETE ON compromisso_acompanhamento
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER compromisso_acompanhamento_sem_exclusao BEFORE DELETE ON compromisso_acompanhamento
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint

-- Toda iniciativa ativa tem pelo menos um projeto ou tema vigente (contexto de
-- visibilidade, Q-24 provisória). Verificado ao fim da transação, para permitir
-- gravar a iniciativa e as suas ligações juntas.
CREATE FUNCTION verificar_iniciativa_com_contexto() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'iniciativa' THEN
    v_id := NEW.id;
  ELSE
    v_id := NEW.iniciativa_id;
  END IF;
  IF EXISTS (SELECT 1 FROM iniciativa WHERE id = v_id AND arquivado_em IS NULL)
     AND NOT EXISTS (SELECT 1 FROM iniciativa_projeto_tema WHERE iniciativa_id = v_id AND arquivado_em IS NULL) THEN
    RAISE EXCEPTION 'A iniciativa precisa estar ligada a pelo menos um projeto ou tema.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER iniciativa_com_contexto AFTER INSERT OR UPDATE ON iniciativa
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verificar_iniciativa_com_contexto();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER iniciativa_projeto_tema_mantem_contexto AFTER UPDATE ON iniciativa_projeto_tema
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verificar_iniciativa_com_contexto();
--> statement-breakpoint

-- Toda interação ativa se refere a pelo menos um projeto, tema ou iniciativa.
CREATE FUNCTION verificar_interacao_com_contexto() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'interacao' THEN
    v_id := NEW.id;
  ELSE
    v_id := NEW.interacao_id;
  END IF;
  IF EXISTS (SELECT 1 FROM interacao WHERE id = v_id AND arquivado_em IS NULL)
     AND NOT EXISTS (SELECT 1 FROM interacao_projeto_tema WHERE interacao_id = v_id AND arquivado_em IS NULL)
     AND NOT EXISTS (SELECT 1 FROM interacao_iniciativa WHERE interacao_id = v_id AND arquivado_em IS NULL) THEN
    RAISE EXCEPTION 'A interação precisa estar ligada a pelo menos um projeto, tema ou iniciativa.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER interacao_com_contexto AFTER INSERT OR UPDATE ON interacao
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verificar_interacao_com_contexto();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER interacao_projeto_tema_mantem_contexto AFTER UPDATE ON interacao_projeto_tema
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verificar_interacao_com_contexto();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER interacao_iniciativa_mantem_contexto AFTER UPDATE ON interacao_iniciativa
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verificar_interacao_com_contexto();
--> statement-breakpoint

-- Ligações não mudam de lado: só se arquivam (retirada), reativam ou têm o campo
-- descritivo ajustado (informado nos argumentos do gatilho).
CREATE FUNCTION proteger_ligacao() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_livres text[] := ARRAY['arquivado_em', 'atualizado_em', 'atualizado_por'] || TG_ARGV;
BEGIN
  IF (to_jsonb(NEW) - v_livres) IS DISTINCT FROM (to_jsonb(OLD) - v_livres) THEN
    RAISE EXCEPTION 'Esta ligação não pode ser alterada; retire-a e inclua uma nova.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER iniciativa_projeto_tema_protegida BEFORE UPDATE ON iniciativa_projeto_tema
  FOR EACH ROW EXECUTE FUNCTION proteger_ligacao();
--> statement-breakpoint
CREATE TRIGGER iniciativa_stakeholder_protegida BEFORE UPDATE ON iniciativa_stakeholder
  FOR EACH ROW EXECUTE FUNCTION proteger_ligacao('observacao');
--> statement-breakpoint
CREATE TRIGGER interacao_participante_protegida BEFORE UPDATE ON interacao_participante
  FOR EACH ROW EXECUTE FUNCTION proteger_ligacao('presenca');
--> statement-breakpoint
CREATE TRIGGER interacao_projeto_tema_protegida BEFORE UPDATE ON interacao_projeto_tema
  FOR EACH ROW EXECUTE FUNCTION proteger_ligacao();
--> statement-breakpoint
CREATE TRIGGER interacao_iniciativa_protegida BEFORE UPDATE ON interacao_iniciativa
  FOR EACH ROW EXECUTE FUNCTION proteger_ligacao('contribuicao');
--> statement-breakpoint

-- O histórico de acompanhamento é preservado: corrige-se com um novo registro.
CREATE FUNCTION proteger_acompanhamento() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.compromisso_id IS DISTINCT FROM OLD.compromisso_id
     OR NEW.data IS DISTINCT FROM OLD.data
     OR NEW.registro IS DISTINCT FROM OLD.registro
     OR NEW.situacao IS DISTINCT FROM OLD.situacao THEN
    RAISE EXCEPTION 'Os registros de acompanhamento não são alterados; registre um novo acompanhamento.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER compromisso_acompanhamento_protegido BEFORE UPDATE ON compromisso_acompanhamento
  FOR EACH ROW EXECUTE FUNCTION proteger_acompanhamento();
