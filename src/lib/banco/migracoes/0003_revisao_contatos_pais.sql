-- Revisão de homologação da Etapa 1 (decisões D-024 e D-025; correções C2, C4 e C5).
-- Gerado pelo drizzle-kit e completado manualmente: gatilhos da tabela contato e
-- migração dos e-mails e telefones das pessoas para ela, ANTES da remoção das colunas.
CREATE TYPE "public"."natureza_contato" AS ENUM('pessoal', 'institucional', 'funcional');--> statement-breakpoint
CREATE TYPE "public"."tipo_contato" AS ENUM('email', 'telefone', 'celular', 'site', 'outro');--> statement-breakpoint
CREATE TABLE "contato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stakeholder_id" uuid NOT NULL,
	"vinculo_id" uuid,
	"tipo" "tipo_contato" NOT NULL,
	"valor" text NOT NULL,
	"valor_normalizado" text NOT NULL,
	"natureza" "natureza_contato" NOT NULL,
	"principal" boolean DEFAULT false NOT NULL,
	"data_inicio" date,
	"data_fim" date,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "contato_valor_preenchido" CHECK (length(trim("contato"."valor")) > 0),
	CONSTRAINT "contato_datas" CHECK ("contato"."data_inicio" is null or "contato"."data_fim" is null or "contato"."data_fim" >= "contato"."data_inicio")
);
--> statement-breakpoint
DROP INDEX "instituicao_cnpj_unico";--> statement-breakpoint
DROP INDEX "pessoa_email_unico";--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "pais" text DEFAULT 'BR' NOT NULL;--> statement-breakpoint
ALTER TABLE "contato" ADD CONSTRAINT "contato_stakeholder_id_stakeholder_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contato" ADD CONSTRAINT "contato_vinculo_id_vinculo_pessoa_instituicao_id_fk" FOREIGN KEY ("vinculo_id") REFERENCES "public"."vinculo_pessoa_instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contato" ADD CONSTRAINT "contato_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contato" ADD CONSTRAINT "contato_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contato_principal_vigente_unico" ON "contato" USING btree ("stakeholder_id","tipo") WHERE "contato"."principal" and "contato"."data_fim" is null and "contato"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "contato_stakeholder_idx" ON "contato" USING btree ("stakeholder_id");--> statement-breakpoint
CREATE INDEX "contato_valor_normalizado_idx" ON "contato" USING btree ("valor_normalizado");--> statement-breakpoint
CREATE INDEX "instituicao_cnpj_idx" ON "instituicao" USING btree ("cnpj");--> statement-breakpoint

-- Gatilhos comuns (funções criadas em 0001_gatilhos.sql).
CREATE TRIGGER contato_controle BEFORE INSERT OR UPDATE ON contato
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER contato_auditoria AFTER INSERT OR UPDATE OR DELETE ON contato
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER contato_sem_exclusao BEFORE DELETE ON contato
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint

-- Contato ligado a um vínculo: o vínculo deve ser da própria pessoa.
CREATE FUNCTION verificar_vinculo_do_contato() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.vinculo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM vinculo_pessoa_instituicao
    WHERE id = NEW.vinculo_id AND pessoa_id = NEW.stakeholder_id
  ) THEN
    RAISE EXCEPTION 'O vínculo informado não pertence a esta pessoa.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER contato_vinculo_valido BEFORE INSERT OR UPDATE ON contato
  FOR EACH ROW EXECUTE FUNCTION verificar_vinculo_do_contato();
--> statement-breakpoint

-- Ao encerrar um vínculo, os contatos ligados a ele são encerrados na mesma data
-- (por exemplo, o e-mail do cargo deixa de valer para quem saiu).
CREATE FUNCTION encerrar_contatos_do_vinculo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.data_fim IS NULL AND NEW.data_fim IS NOT NULL THEN
    UPDATE contato
       SET data_fim = NEW.data_fim
     WHERE vinculo_id = NEW.id
       AND data_fim IS NULL
       AND arquivado_em IS NULL
       AND (data_inicio IS NULL OR data_inicio <= NEW.data_fim);
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE TRIGGER vinculo_encerra_contatos AFTER UPDATE OF data_fim ON vinculo_pessoa_instituicao
  FOR EACH ROW EXECUTE FUNCTION encerrar_contatos_do_vinculo();
--> statement-breakpoint

-- Migração dos dados existentes: e-mails e telefones das pessoas viram contatos.
INSERT INTO contato (stakeholder_id, tipo, valor, valor_normalizado, natureza, principal, criado_por, observacao)
SELECT id, 'email', trim(email), lower(trim(email)), 'institucional', true, criado_por,
       'Migrado do cadastro da pessoa (revisão da Etapa 1).'
FROM pessoa
WHERE email IS NOT NULL AND trim(email) <> '';
--> statement-breakpoint
INSERT INTO contato (stakeholder_id, tipo, valor, valor_normalizado, natureza, principal, criado_por, observacao)
SELECT id, 'telefone', trim(telefone), regexp_replace(telefone, '\D', '', 'g'), 'institucional', true, criado_por,
       'Migrado do cadastro da pessoa (revisão da Etapa 1).'
FROM pessoa
WHERE telefone IS NOT NULL AND trim(telefone) <> '';
--> statement-breakpoint

ALTER TABLE "pessoa" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "pessoa" DROP COLUMN "telefone";--> statement-breakpoint
ALTER TABLE "instituicao" ADD CONSTRAINT "instituicao_pais_formato" CHECK ("instituicao"."pais" ~ '^[A-Z]{2}$');--> statement-breakpoint
ALTER TABLE "instituicao" ADD CONSTRAINT "instituicao_uf_somente_brasil" CHECK ("instituicao"."pais" = 'BR' or "instituicao"."uf" is null);--> statement-breakpoint
ALTER TABLE "instituicao" ADD CONSTRAINT "instituicao_cnpj_somente_brasil" CHECK ("instituicao"."pais" = 'BR' or "instituicao"."cnpj" is null);
