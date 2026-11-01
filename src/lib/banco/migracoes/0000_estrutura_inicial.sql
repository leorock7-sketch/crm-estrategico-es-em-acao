CREATE TYPE "public"."esfera_instituicao" AS ENUM('federal', 'estadual', 'municipal', 'nao_se_aplica');--> statement-breakpoint
CREATE TYPE "public"."natureza_instituicao" AS ENUM('orgao_publico', 'empresa', 'entidade_classe', 'academia', 'terceiro_setor', 'imprensa', 'outra');--> statement-breakpoint
CREATE TYPE "public"."operacao_auditoria" AS ENUM('inclusao', 'alteracao', 'arquivamento', 'reativacao', 'exclusao');--> statement-breakpoint
CREATE TYPE "public"."situacao_projeto_tema" AS ENUM('proposto', 'ativo', 'suspenso', 'concluido');--> statement-breakpoint
CREATE TYPE "public"."situacao_usuario" AS ENUM('ativo', 'inativo');--> statement-breakpoint
CREATE TYPE "public"."tipo_comite" AS ENUM('desenvolvimento', 'tematico');--> statement-breakpoint
CREATE TYPE "public"."tipo_projeto_tema" AS ENUM('projeto', 'tema');--> statement-breakpoint
CREATE TYPE "public"."tipo_stakeholder" AS ENUM('pessoa', 'instituicao');--> statement-breakpoint
CREATE TABLE "comite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"sigla" text,
	"tipo" "tipo_comite" NOT NULL,
	"comite_superior_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "comite_nome_unico" UNIQUE("nome"),
	CONSTRAINT "comite_sigla_unica" UNIQUE("sigla"),
	CONSTRAINT "comite_superior_coerente" CHECK (("comite"."tipo" = 'desenvolvimento' and "comite"."comite_superior_id" is null) or ("comite"."tipo" = 'tematico' and "comite"."comite_superior_id" is not null)),
	CONSTRAINT "comite_nao_superior_de_si" CHECK ("comite"."comite_superior_id" is distinct from "comite"."id")
);
--> statement-breakpoint
CREATE TABLE "instituicao" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tipo_stakeholder" "tipo_stakeholder" DEFAULT 'instituicao' NOT NULL,
	"nome" text NOT NULL,
	"sigla" text,
	"nome_normalizado" text NOT NULL,
	"natureza" "natureza_instituicao" NOT NULL,
	"esfera" "esfera_instituicao",
	"cnpj" text,
	"uf" text,
	"municipio" text,
	"site" text,
	"instituicao_superior_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "instituicao_tipo_stakeholder" CHECK ("instituicao"."tipo_stakeholder" = 'instituicao'),
	CONSTRAINT "instituicao_nome_preenchido" CHECK (length(trim("instituicao"."nome")) > 0),
	CONSTRAINT "instituicao_cnpj_formato" CHECK ("instituicao"."cnpj" is null or "instituicao"."cnpj" ~ '^[0-9A-Z]{12}[0-9]{2}$'),
	CONSTRAINT "instituicao_uf_formato" CHECK ("instituicao"."uf" is null or "instituicao"."uf" ~ '^[A-Z]{2}$'),
	CONSTRAINT "instituicao_nao_superior_de_si" CHECK ("instituicao"."instituicao_superior_id" is distinct from "instituicao"."id")
);
--> statement-breakpoint
CREATE TABLE "pessoa" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tipo_stakeholder" "tipo_stakeholder" DEFAULT 'pessoa' NOT NULL,
	"nome_completo" text NOT NULL,
	"nome_tratamento" text,
	"nome_normalizado" text NOT NULL,
	"email" text,
	"telefone" text,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "pessoa_tipo_stakeholder" CHECK ("pessoa"."tipo_stakeholder" = 'pessoa'),
	CONSTRAINT "pessoa_nome_preenchido" CHECK (length(trim("pessoa"."nome_completo")) > 0)
);
--> statement-breakpoint
CREATE TABLE "projeto_tema" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_projeto_tema" NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"comite_id" uuid NOT NULL,
	"situacao" "situacao_projeto_tema" DEFAULT 'proposto' NOT NULL,
	"data_inicio" date,
	"data_fim" date,
	"responsavel_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "projeto_tema_nome_unico" UNIQUE("comite_id","tipo","nome"),
	CONSTRAINT "projeto_tema_datas" CHECK ("projeto_tema"."data_inicio" is null or "projeto_tema"."data_fim" is null or "projeto_tema"."data_fim" >= "projeto_tema"."data_inicio")
);
--> statement-breakpoint
CREATE TABLE "registro_auditoria" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "registro_auditoria_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tabela" text NOT NULL,
	"registro_id" uuid NOT NULL,
	"operacao" "operacao_auditoria" NOT NULL,
	"dados_anteriores" jsonb,
	"dados_novos" jsonb,
	"usuario_id" uuid,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stakeholder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_stakeholder" NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	CONSTRAINT "stakeholder_id_tipo_unico" UNIQUE("id","tipo")
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"administrador" boolean DEFAULT false NOT NULL,
	"situacao" "situacao_usuario" DEFAULT 'ativo' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vinculo_pessoa_instituicao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"cargo" text,
	"area" text,
	"data_inicio" date,
	"data_fim" date,
	"principal" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "vinculo_datas" CHECK ("vinculo_pessoa_instituicao"."data_inicio" is null or "vinculo_pessoa_instituicao"."data_fim" is null or "vinculo_pessoa_instituicao"."data_fim" >= "vinculo_pessoa_instituicao"."data_inicio")
);
--> statement-breakpoint
ALTER TABLE "comite" ADD CONSTRAINT "comite_comite_superior_id_comite_id_fk" FOREIGN KEY ("comite_superior_id") REFERENCES "public"."comite"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comite" ADD CONSTRAINT "comite_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comite" ADD CONSTRAINT "comite_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instituicao" ADD CONSTRAINT "instituicao_instituicao_superior_id_instituicao_id_fk" FOREIGN KEY ("instituicao_superior_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instituicao" ADD CONSTRAINT "instituicao_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instituicao" ADD CONSTRAINT "instituicao_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instituicao" ADD CONSTRAINT "instituicao_stakeholder_fk" FOREIGN KEY ("id","tipo_stakeholder") REFERENCES "public"."stakeholder"("id","tipo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "pessoa_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "pessoa_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "pessoa_stakeholder_fk" FOREIGN KEY ("id","tipo_stakeholder") REFERENCES "public"."stakeholder"("id","tipo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projeto_tema" ADD CONSTRAINT "projeto_tema_comite_id_comite_id_fk" FOREIGN KEY ("comite_id") REFERENCES "public"."comite"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projeto_tema" ADD CONSTRAINT "projeto_tema_responsavel_id_usuario_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projeto_tema" ADD CONSTRAINT "projeto_tema_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projeto_tema" ADD CONSTRAINT "projeto_tema_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro_auditoria" ADD CONSTRAINT "registro_auditoria_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder" ADD CONSTRAINT "stakeholder_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo_pessoa_instituicao" ADD CONSTRAINT "vinculo_pessoa_instituicao_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo_pessoa_instituicao" ADD CONSTRAINT "vinculo_pessoa_instituicao_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo_pessoa_instituicao" ADD CONSTRAINT "vinculo_pessoa_instituicao_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo_pessoa_instituicao" ADD CONSTRAINT "vinculo_pessoa_instituicao_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instituicao_cnpj_unico" ON "instituicao" USING btree ("cnpj") WHERE "instituicao"."cnpj" is not null;--> statement-breakpoint
CREATE INDEX "instituicao_nome_normalizado_idx" ON "instituicao" USING btree ("nome_normalizado");--> statement-breakpoint
CREATE UNIQUE INDEX "pessoa_email_unico" ON "pessoa" USING btree (lower("email")) WHERE "pessoa"."email" is not null;--> statement-breakpoint
CREATE INDEX "pessoa_nome_normalizado_idx" ON "pessoa" USING btree ("nome_normalizado");--> statement-breakpoint
CREATE INDEX "registro_auditoria_registro_idx" ON "registro_auditoria" USING btree ("tabela","registro_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuario_email_unico" ON "usuario" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "vinculo_principal_vigente_unico" ON "vinculo_pessoa_instituicao" USING btree ("pessoa_id") WHERE "vinculo_pessoa_instituicao"."principal" and "vinculo_pessoa_instituicao"."data_fim" is null and "vinculo_pessoa_instituicao"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "vinculo_pessoa_idx" ON "vinculo_pessoa_instituicao" USING btree ("pessoa_id");--> statement-breakpoint
CREATE INDEX "vinculo_instituicao_idx" ON "vinculo_pessoa_instituicao" USING btree ("instituicao_id");