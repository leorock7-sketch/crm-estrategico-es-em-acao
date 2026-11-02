-- Etapa 1.1 (decisões D-023 e D-030): comitês participantes e stakeholders dos contextos.
-- Gerado pelo drizzle-kit e completado manualmente com os gatilhos ao final.
CREATE TYPE "public"."tipo_relacao_contexto" AS ENUM('orgao_competente', 'parceiro', 'financiador', 'executor', 'beneficiario', 'representacao_setorial', 'outro');--> statement-breakpoint
CREATE TABLE "projeto_tema_comite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projeto_tema_id" uuid NOT NULL,
	"comite_id" uuid NOT NULL,
	"data_inicio" date,
	"data_fim" date,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "projeto_tema_comite_datas" CHECK ("projeto_tema_comite"."data_inicio" is null or "projeto_tema_comite"."data_fim" is null or "projeto_tema_comite"."data_fim" >= "projeto_tema_comite"."data_inicio")
);
--> statement-breakpoint
CREATE TABLE "stakeholder_contexto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stakeholder_id" uuid NOT NULL,
	"projeto_tema_id" uuid NOT NULL,
	"tipo_relacao" "tipo_relacao_contexto" NOT NULL,
	"descricao" text,
	"data_inicio" date,
	"data_fim" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "stakeholder_contexto_datas" CHECK ("stakeholder_contexto"."data_inicio" is null or "stakeholder_contexto"."data_fim" is null or "stakeholder_contexto"."data_fim" >= "stakeholder_contexto"."data_inicio")
);
--> statement-breakpoint
-- Coluna obrigatória adicionada com valor provisório, para não falhar se já houver registros.
ALTER TABLE "projeto_tema" ADD COLUMN "nome_normalizado" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "projeto_tema" SET "nome_normalizado" = lower(trim("nome"));--> statement-breakpoint
ALTER TABLE "projeto_tema" ALTER COLUMN "nome_normalizado" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "projeto_tema_comite" ADD CONSTRAINT "projeto_tema_comite_projeto_tema_id_projeto_tema_id_fk" FOREIGN KEY ("projeto_tema_id") REFERENCES "public"."projeto_tema"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projeto_tema_comite" ADD CONSTRAINT "projeto_tema_comite_comite_id_comite_id_fk" FOREIGN KEY ("comite_id") REFERENCES "public"."comite"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projeto_tema_comite" ADD CONSTRAINT "projeto_tema_comite_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projeto_tema_comite" ADD CONSTRAINT "projeto_tema_comite_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder_contexto" ADD CONSTRAINT "stakeholder_contexto_stakeholder_id_stakeholder_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder_contexto" ADD CONSTRAINT "stakeholder_contexto_projeto_tema_id_projeto_tema_id_fk" FOREIGN KEY ("projeto_tema_id") REFERENCES "public"."projeto_tema"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder_contexto" ADD CONSTRAINT "stakeholder_contexto_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder_contexto" ADD CONSTRAINT "stakeholder_contexto_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projeto_tema_comite_vigente_unico" ON "projeto_tema_comite" USING btree ("projeto_tema_id","comite_id") WHERE "projeto_tema_comite"."data_fim" is null and "projeto_tema_comite"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "projeto_tema_comite_comite_idx" ON "projeto_tema_comite" USING btree ("comite_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stakeholder_contexto_vigente_unico" ON "stakeholder_contexto" USING btree ("stakeholder_id","projeto_tema_id","tipo_relacao") WHERE "stakeholder_contexto"."data_fim" is null and "stakeholder_contexto"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "stakeholder_contexto_projeto_idx" ON "stakeholder_contexto" USING btree ("projeto_tema_id");--> statement-breakpoint
CREATE INDEX "stakeholder_contexto_stakeholder_idx" ON "stakeholder_contexto" USING btree ("stakeholder_id");--> statement-breakpoint
CREATE INDEX "projeto_tema_comite_principal_idx" ON "projeto_tema" USING btree ("comite_id");--> statement-breakpoint
CREATE INDEX "projeto_tema_nome_normalizado_idx" ON "projeto_tema" USING btree ("nome_normalizado");--> statement-breakpoint
ALTER TABLE "projeto_tema" ADD CONSTRAINT "projeto_tema_nome_preenchido" CHECK (length(trim("projeto_tema"."nome")) > 0);--> statement-breakpoint

-- Gatilhos comuns (funções criadas em 0001_gatilhos.sql).
CREATE TRIGGER projeto_tema_comite_controle BEFORE INSERT OR UPDATE ON projeto_tema_comite
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER projeto_tema_comite_auditoria AFTER INSERT OR UPDATE OR DELETE ON projeto_tema_comite
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER projeto_tema_comite_sem_exclusao BEFORE DELETE ON projeto_tema_comite
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER stakeholder_contexto_controle BEFORE INSERT OR UPDATE ON stakeholder_contexto
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER stakeholder_contexto_auditoria AFTER INSERT OR UPDATE OR DELETE ON stakeholder_contexto
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER stakeholder_contexto_sem_exclusao BEFORE DELETE ON stakeholder_contexto
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint

-- O comitê principal não pode ser, ao mesmo tempo, participante vigente (D-023).
CREATE FUNCTION verificar_participante_nao_principal() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.data_fim IS NULL AND NEW.arquivado_em IS NULL AND EXISTS (
    SELECT 1 FROM projeto_tema WHERE id = NEW.projeto_tema_id AND comite_id = NEW.comite_id
  ) THEN
    RAISE EXCEPTION 'O comitê principal não pode ser também comitê participante.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER projeto_tema_comite_nao_principal BEFORE INSERT OR UPDATE ON projeto_tema_comite
  FOR EACH ROW EXECUTE FUNCTION verificar_participante_nao_principal();
--> statement-breakpoint

-- Ao trocar o comitê principal, o novo principal não pode ser participante vigente.
CREATE FUNCTION verificar_principal_nao_participante() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.comite_id IS DISTINCT FROM OLD.comite_id AND EXISTS (
    SELECT 1 FROM projeto_tema_comite
    WHERE projeto_tema_id = NEW.id AND comite_id = NEW.comite_id
      AND data_fim IS NULL AND arquivado_em IS NULL
  ) THEN
    RAISE EXCEPTION 'O novo comitê principal já é participante deste projeto ou tema. Encerre a participação antes de torná-lo principal.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER projeto_tema_principal_valido BEFORE UPDATE OF comite_id ON projeto_tema
  FOR EACH ROW EXECUTE FUNCTION verificar_principal_nao_participante();
