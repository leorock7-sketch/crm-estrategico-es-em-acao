-- Etapa 4 (D-072): Plano de Ação e Matriz de Riscos. Somente acréscimos: tabelas
-- novas e um campo opcional em compromisso (ação em que foi convertido). Gerado
-- pelo drizzle-kit e completado manualmente com os gatilhos ao final.
CREATE TYPE "public"."decisao_plano" AS ENUM('enviada', 'devolvida', 'aprovada', 'rejeitada');--> statement-breakpoint
CREATE TYPE "public"."estrategia_resposta" AS ENUM('evitar', 'mitigar', 'transferir', 'aceitar');--> statement-breakpoint
CREATE TYPE "public"."periodicidade_acao" AS ENUM('mensal', 'bimestral', 'trimestral', 'semestral', 'anual');--> statement-breakpoint
CREATE TYPE "public"."situacao_acao" AS ENUM('nao_iniciada', 'em_andamento', 'concluida', 'suspensa', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."situacao_resposta" AS ENUM('planejada', 'em_execucao', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."situacao_risco" AS ENUM('aberto', 'em_mitigacao', 'monitorado', 'mitigado', 'escalonado');--> statement-breakpoint
CREATE TYPE "public"."situacao_versao_plano" AS ENUM('rascunho', 'em_aprovacao', 'aprovada', 'rejeitada', 'substituida');--> statement-breakpoint
CREATE TYPE "public"."tipo_avaliacao_risco" AS ENUM('inerente', 'residual');--> statement-breakpoint
CREATE TABLE "acao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plano_acao_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"iniciativa_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "acao_codigo_unico" UNIQUE("plano_acao_id","codigo")
);
--> statement-breakpoint
CREATE TABLE "acao_acompanhamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"acao_id" uuid NOT NULL,
	"data" date NOT NULL,
	"situacao" "situacao_acao",
	"percentual" integer,
	"observacao" text,
	"marco_id" uuid,
	"marco_alcancado" boolean,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "acao_acompanhamento_percentual" CHECK ("acao_acompanhamento"."percentual" is null or "acao_acompanhamento"."percentual" between 0 and 100),
	CONSTRAINT "acao_acompanhamento_marco" CHECK (("acao_acompanhamento"."marco_id" is null) = ("acao_acompanhamento"."marco_alcancado" is null)),
	CONSTRAINT "acao_acompanhamento_preenchido" CHECK ("acao_acompanhamento"."situacao" is not null or "acao_acompanhamento"."percentual" is not null or "acao_acompanhamento"."marco_id" is not null or length(trim(coalesce("acao_acompanhamento"."observacao", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "acao_marco" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"acao_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "acao_marco_codigo_unico" UNIQUE("acao_id","codigo")
);
--> statement-breakpoint
CREATE TABLE "acao_planejamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"acao_id" uuid NOT NULL,
	"plano_acao_versao_id" uuid NOT NULL,
	"eixo_id" uuid,
	"titulo" text NOT NULL,
	"descricao" text,
	"justificativa" text,
	"responsavel_usuario_id" uuid,
	"responsavel_stakeholder_id" uuid,
	"inicio_previsto" date,
	"fim_previsto" date,
	"periodicidade" "periodicidade_acao",
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "acao_planejamento_titulo_preenchido" CHECK (length(trim("acao_planejamento"."titulo")) > 0),
	CONSTRAINT "acao_planejamento_datas" CHECK ("acao_planejamento"."inicio_previsto" is null or "acao_planejamento"."fim_previsto" is null or "acao_planejamento"."fim_previsto" >= "acao_planejamento"."inicio_previsto"),
	CONSTRAINT "acao_planejamento_com_responsavel" CHECK ("acao_planejamento"."responsavel_usuario_id" is not null or "acao_planejamento"."responsavel_stakeholder_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "acao_stakeholder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"acao_id" uuid NOT NULL,
	"stakeholder_id" uuid NOT NULL,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "marco_planejamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marco_id" uuid NOT NULL,
	"plano_acao_versao_id" uuid NOT NULL,
	"descricao" text NOT NULL,
	"prazo_previsto" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "marco_planejamento_descricao_preenchida" CHECK (length(trim("marco_planejamento"."descricao")) > 0)
);
--> statement-breakpoint
CREATE TABLE "plano_acao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projeto_tema_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"objetivo" text,
	"responsavel_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "plano_acao_titulo_preenchido" CHECK (length(trim("plano_acao"."titulo")) > 0)
);
--> statement-breakpoint
CREATE TABLE "plano_acao_decisao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plano_acao_versao_id" uuid NOT NULL,
	"decisao" "decisao_plano" NOT NULL,
	"parecer" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plano_acao_versao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plano_acao_id" uuid NOT NULL,
	"numero_versao" integer NOT NULL,
	"situacao" "situacao_versao_plano" DEFAULT 'rascunho' NOT NULL,
	"motivo_alteracao" text,
	"proposta_por" uuid,
	"proposta_em" timestamp with time zone,
	"decidida_por" uuid,
	"decidida_em" timestamp with time zone,
	"parecer" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "plano_acao_versao_numero_unico" UNIQUE("plano_acao_id","numero_versao"),
	CONSTRAINT "plano_acao_versao_decisao_registrada" CHECK ("plano_acao_versao"."situacao" not in ('aprovada', 'rejeitada', 'substituida') or ("plano_acao_versao"."decidida_por" is not null and "plano_acao_versao"."decidida_em" is not null))
);
--> statement-breakpoint
CREATE TABLE "plano_eixo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plano_acao_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"objetivo" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "plano_eixo_nome_preenchido" CHECK (length(trim("plano_eixo"."nome")) > 0)
);
--> statement-breakpoint
CREATE TABLE "risco" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projeto_tema_id" uuid NOT NULL,
	"iniciativa_id" uuid,
	"eixo_id" uuid,
	"codigo" text NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"causa" text,
	"consequencia" text,
	"controles_existentes" text,
	"responsavel_id" uuid,
	"situacao" "situacao_risco" DEFAULT 'aberto' NOT NULL,
	"proxima_revisao" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "risco_codigo_unico" UNIQUE("projeto_tema_id","codigo"),
	CONSTRAINT "risco_titulo_preenchido" CHECK (length(trim("risco"."titulo")) > 0)
);
--> statement-breakpoint
CREATE TABLE "risco_avaliacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"risco_id" uuid NOT NULL,
	"tipo" "tipo_avaliacao_risco" NOT NULL,
	"data_avaliacao" date NOT NULL,
	"probabilidade" integer NOT NULL,
	"impacto" integer NOT NULL,
	"criticidade" integer GENERATED ALWAYS AS (probabilidade * impacto) STORED NOT NULL,
	"classificacao" text GENERATED ALWAYS AS (case when probabilidade * impacto <= 4 then 'baixo' when probabilidade * impacto <= 9 then 'moderado' when probabilidade * impacto <= 16 then 'alto' else 'critico' end) STORED NOT NULL,
	"justificativa" text NOT NULL,
	"avaliado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "risco_avaliacao_probabilidade" CHECK ("risco_avaliacao"."probabilidade" between 1 and 5),
	CONSTRAINT "risco_avaliacao_impacto" CHECK ("risco_avaliacao"."impacto" between 1 and 5),
	CONSTRAINT "risco_avaliacao_justificativa_preenchida" CHECK (length(trim("risco_avaliacao"."justificativa")) > 0)
);
--> statement-breakpoint
CREATE TABLE "risco_gatilho" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"risco_id" uuid NOT NULL,
	"descricao" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "risco_gatilho_descricao_preenchida" CHECK (length(trim("risco_gatilho"."descricao")) > 0)
);
--> statement-breakpoint
CREATE TABLE "risco_gatilho_registro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gatilho_id" uuid NOT NULL,
	"data" date NOT NULL,
	"ocorrido" boolean NOT NULL,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "risco_resposta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"risco_id" uuid NOT NULL,
	"estrategia" "estrategia_resposta" NOT NULL,
	"descricao" text NOT NULL,
	"responsavel_usuario_id" uuid,
	"responsavel_stakeholder_id" uuid,
	"prazo" date,
	"situacao" "situacao_resposta" DEFAULT 'planejada' NOT NULL,
	"acao_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "risco_resposta_descricao_preenchida" CHECK (length(trim("risco_resposta"."descricao")) > 0)
);
--> statement-breakpoint
CREATE TABLE "risco_stakeholder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"risco_id" uuid NOT NULL,
	"stakeholder_id" uuid NOT NULL,
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "compromisso" ADD COLUMN "acao_id" uuid;--> statement-breakpoint
ALTER TABLE "acao" ADD CONSTRAINT "acao_plano_acao_id_plano_acao_id_fk" FOREIGN KEY ("plano_acao_id") REFERENCES "public"."plano_acao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao" ADD CONSTRAINT "acao_iniciativa_id_iniciativa_id_fk" FOREIGN KEY ("iniciativa_id") REFERENCES "public"."iniciativa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao" ADD CONSTRAINT "acao_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao" ADD CONSTRAINT "acao_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_acompanhamento" ADD CONSTRAINT "acao_acompanhamento_acao_id_acao_id_fk" FOREIGN KEY ("acao_id") REFERENCES "public"."acao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_acompanhamento" ADD CONSTRAINT "acao_acompanhamento_marco_id_acao_marco_id_fk" FOREIGN KEY ("marco_id") REFERENCES "public"."acao_marco"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_acompanhamento" ADD CONSTRAINT "acao_acompanhamento_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_acompanhamento" ADD CONSTRAINT "acao_acompanhamento_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_marco" ADD CONSTRAINT "acao_marco_acao_id_acao_id_fk" FOREIGN KEY ("acao_id") REFERENCES "public"."acao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_marco" ADD CONSTRAINT "acao_marco_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_marco" ADD CONSTRAINT "acao_marco_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_planejamento" ADD CONSTRAINT "acao_planejamento_acao_id_acao_id_fk" FOREIGN KEY ("acao_id") REFERENCES "public"."acao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_planejamento" ADD CONSTRAINT "acao_planejamento_plano_acao_versao_id_plano_acao_versao_id_fk" FOREIGN KEY ("plano_acao_versao_id") REFERENCES "public"."plano_acao_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_planejamento" ADD CONSTRAINT "acao_planejamento_eixo_id_plano_eixo_id_fk" FOREIGN KEY ("eixo_id") REFERENCES "public"."plano_eixo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_planejamento" ADD CONSTRAINT "acao_planejamento_responsavel_usuario_id_usuario_id_fk" FOREIGN KEY ("responsavel_usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_planejamento" ADD CONSTRAINT "acao_planejamento_responsavel_stakeholder_id_stakeholder_id_fk" FOREIGN KEY ("responsavel_stakeholder_id") REFERENCES "public"."stakeholder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_planejamento" ADD CONSTRAINT "acao_planejamento_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_planejamento" ADD CONSTRAINT "acao_planejamento_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_stakeholder" ADD CONSTRAINT "acao_stakeholder_acao_id_acao_id_fk" FOREIGN KEY ("acao_id") REFERENCES "public"."acao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_stakeholder" ADD CONSTRAINT "acao_stakeholder_stakeholder_id_stakeholder_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_stakeholder" ADD CONSTRAINT "acao_stakeholder_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acao_stakeholder" ADD CONSTRAINT "acao_stakeholder_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marco_planejamento" ADD CONSTRAINT "marco_planejamento_marco_id_acao_marco_id_fk" FOREIGN KEY ("marco_id") REFERENCES "public"."acao_marco"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marco_planejamento" ADD CONSTRAINT "marco_planejamento_plano_acao_versao_id_plano_acao_versao_id_fk" FOREIGN KEY ("plano_acao_versao_id") REFERENCES "public"."plano_acao_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marco_planejamento" ADD CONSTRAINT "marco_planejamento_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marco_planejamento" ADD CONSTRAINT "marco_planejamento_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_acao" ADD CONSTRAINT "plano_acao_projeto_tema_id_projeto_tema_id_fk" FOREIGN KEY ("projeto_tema_id") REFERENCES "public"."projeto_tema"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_acao" ADD CONSTRAINT "plano_acao_responsavel_id_usuario_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_acao" ADD CONSTRAINT "plano_acao_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_acao" ADD CONSTRAINT "plano_acao_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_acao_decisao" ADD CONSTRAINT "plano_acao_decisao_plano_acao_versao_id_plano_acao_versao_id_fk" FOREIGN KEY ("plano_acao_versao_id") REFERENCES "public"."plano_acao_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_acao_decisao" ADD CONSTRAINT "plano_acao_decisao_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_acao_decisao" ADD CONSTRAINT "plano_acao_decisao_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_acao_versao" ADD CONSTRAINT "plano_acao_versao_plano_acao_id_plano_acao_id_fk" FOREIGN KEY ("plano_acao_id") REFERENCES "public"."plano_acao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_acao_versao" ADD CONSTRAINT "plano_acao_versao_proposta_por_usuario_id_fk" FOREIGN KEY ("proposta_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_acao_versao" ADD CONSTRAINT "plano_acao_versao_decidida_por_usuario_id_fk" FOREIGN KEY ("decidida_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_acao_versao" ADD CONSTRAINT "plano_acao_versao_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_acao_versao" ADD CONSTRAINT "plano_acao_versao_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_eixo" ADD CONSTRAINT "plano_eixo_plano_acao_id_plano_acao_id_fk" FOREIGN KEY ("plano_acao_id") REFERENCES "public"."plano_acao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_eixo" ADD CONSTRAINT "plano_eixo_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano_eixo" ADD CONSTRAINT "plano_eixo_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco" ADD CONSTRAINT "risco_projeto_tema_id_projeto_tema_id_fk" FOREIGN KEY ("projeto_tema_id") REFERENCES "public"."projeto_tema"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco" ADD CONSTRAINT "risco_iniciativa_id_iniciativa_id_fk" FOREIGN KEY ("iniciativa_id") REFERENCES "public"."iniciativa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco" ADD CONSTRAINT "risco_eixo_id_plano_eixo_id_fk" FOREIGN KEY ("eixo_id") REFERENCES "public"."plano_eixo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco" ADD CONSTRAINT "risco_responsavel_id_usuario_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco" ADD CONSTRAINT "risco_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco" ADD CONSTRAINT "risco_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_avaliacao" ADD CONSTRAINT "risco_avaliacao_risco_id_risco_id_fk" FOREIGN KEY ("risco_id") REFERENCES "public"."risco"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_avaliacao" ADD CONSTRAINT "risco_avaliacao_avaliado_por_usuario_id_fk" FOREIGN KEY ("avaliado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_avaliacao" ADD CONSTRAINT "risco_avaliacao_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_avaliacao" ADD CONSTRAINT "risco_avaliacao_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_gatilho" ADD CONSTRAINT "risco_gatilho_risco_id_risco_id_fk" FOREIGN KEY ("risco_id") REFERENCES "public"."risco"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_gatilho" ADD CONSTRAINT "risco_gatilho_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_gatilho" ADD CONSTRAINT "risco_gatilho_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_gatilho_registro" ADD CONSTRAINT "risco_gatilho_registro_gatilho_id_risco_gatilho_id_fk" FOREIGN KEY ("gatilho_id") REFERENCES "public"."risco_gatilho"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_gatilho_registro" ADD CONSTRAINT "risco_gatilho_registro_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_gatilho_registro" ADD CONSTRAINT "risco_gatilho_registro_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_resposta" ADD CONSTRAINT "risco_resposta_risco_id_risco_id_fk" FOREIGN KEY ("risco_id") REFERENCES "public"."risco"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_resposta" ADD CONSTRAINT "risco_resposta_responsavel_usuario_id_usuario_id_fk" FOREIGN KEY ("responsavel_usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_resposta" ADD CONSTRAINT "risco_resposta_responsavel_stakeholder_id_stakeholder_id_fk" FOREIGN KEY ("responsavel_stakeholder_id") REFERENCES "public"."stakeholder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_resposta" ADD CONSTRAINT "risco_resposta_acao_id_acao_id_fk" FOREIGN KEY ("acao_id") REFERENCES "public"."acao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_resposta" ADD CONSTRAINT "risco_resposta_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_resposta" ADD CONSTRAINT "risco_resposta_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_stakeholder" ADD CONSTRAINT "risco_stakeholder_risco_id_risco_id_fk" FOREIGN KEY ("risco_id") REFERENCES "public"."risco"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_stakeholder" ADD CONSTRAINT "risco_stakeholder_stakeholder_id_stakeholder_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_stakeholder" ADD CONSTRAINT "risco_stakeholder_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_stakeholder" ADD CONSTRAINT "risco_stakeholder_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acao_iniciativa_idx" ON "acao" USING btree ("iniciativa_id");--> statement-breakpoint
CREATE INDEX "acao_acompanhamento_acao_idx" ON "acao_acompanhamento" USING btree ("acao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "acao_planejamento_unico" ON "acao_planejamento" USING btree ("acao_id","plano_acao_versao_id") WHERE "acao_planejamento"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "acao_planejamento_versao_idx" ON "acao_planejamento" USING btree ("plano_acao_versao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "acao_stakeholder_unico" ON "acao_stakeholder" USING btree ("acao_id","stakeholder_id") WHERE "acao_stakeholder"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "acao_stakeholder_stakeholder_idx" ON "acao_stakeholder" USING btree ("stakeholder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marco_planejamento_unico" ON "marco_planejamento" USING btree ("marco_id","plano_acao_versao_id") WHERE "marco_planejamento"."arquivado_em" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "plano_acao_projeto_unico" ON "plano_acao" USING btree ("projeto_tema_id") WHERE "plano_acao"."arquivado_em" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "plano_acao_versao_vigente_unica" ON "plano_acao_versao" USING btree ("plano_acao_id") WHERE "plano_acao_versao"."situacao" = 'aprovada';--> statement-breakpoint
CREATE UNIQUE INDEX "plano_acao_versao_elaboracao_unica" ON "plano_acao_versao" USING btree ("plano_acao_id") WHERE "plano_acao_versao"."situacao" in ('rascunho', 'em_aprovacao') and "plano_acao_versao"."arquivado_em" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "plano_eixo_codigo_unico" ON "plano_eixo" USING btree ("plano_acao_id","codigo") WHERE "plano_eixo"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "risco_iniciativa_idx" ON "risco" USING btree ("iniciativa_id");--> statement-breakpoint
CREATE INDEX "risco_avaliacao_risco_idx" ON "risco_avaliacao" USING btree ("risco_id");--> statement-breakpoint
CREATE INDEX "risco_resposta_risco_idx" ON "risco_resposta" USING btree ("risco_id");--> statement-breakpoint
CREATE INDEX "risco_resposta_acao_idx" ON "risco_resposta" USING btree ("acao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "risco_stakeholder_unico" ON "risco_stakeholder" USING btree ("risco_id","stakeholder_id") WHERE "risco_stakeholder"."arquivado_em" is null;--> statement-breakpoint
CREATE INDEX "risco_stakeholder_stakeholder_idx" ON "risco_stakeholder" USING btree ("stakeholder_id");--> statement-breakpoint
ALTER TABLE "compromisso" ADD CONSTRAINT "compromisso_acao_id_acao_id_fk" FOREIGN KEY ("acao_id") REFERENCES "public"."acao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Etapa 4: gatilhos comuns (funções criadas em 0001_gatilhos.sql): quem e quando,
-- trilha de auditoria e proibição de excluir (retirar é arquivar).
--> statement-breakpoint
CREATE TRIGGER plano_acao_controle BEFORE INSERT OR UPDATE ON plano_acao
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER plano_acao_auditoria AFTER INSERT OR UPDATE OR DELETE ON plano_acao
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER plano_acao_sem_exclusao BEFORE DELETE ON plano_acao
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER plano_eixo_controle BEFORE INSERT OR UPDATE ON plano_eixo
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER plano_eixo_auditoria AFTER INSERT OR UPDATE OR DELETE ON plano_eixo
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER plano_eixo_sem_exclusao BEFORE DELETE ON plano_eixo
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER plano_acao_versao_controle BEFORE INSERT OR UPDATE ON plano_acao_versao
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER plano_acao_versao_auditoria AFTER INSERT OR UPDATE OR DELETE ON plano_acao_versao
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER plano_acao_versao_sem_exclusao BEFORE DELETE ON plano_acao_versao
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER plano_acao_decisao_controle BEFORE INSERT OR UPDATE ON plano_acao_decisao
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER plano_acao_decisao_auditoria AFTER INSERT OR UPDATE OR DELETE ON plano_acao_decisao
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER plano_acao_decisao_sem_exclusao BEFORE DELETE ON plano_acao_decisao
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER acao_controle BEFORE INSERT OR UPDATE ON acao
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER acao_auditoria AFTER INSERT OR UPDATE OR DELETE ON acao
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER acao_sem_exclusao BEFORE DELETE ON acao
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER acao_planejamento_controle BEFORE INSERT OR UPDATE ON acao_planejamento
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER acao_planejamento_auditoria AFTER INSERT OR UPDATE OR DELETE ON acao_planejamento
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER acao_planejamento_sem_exclusao BEFORE DELETE ON acao_planejamento
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER acao_marco_controle BEFORE INSERT OR UPDATE ON acao_marco
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER acao_marco_auditoria AFTER INSERT OR UPDATE OR DELETE ON acao_marco
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER acao_marco_sem_exclusao BEFORE DELETE ON acao_marco
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER marco_planejamento_controle BEFORE INSERT OR UPDATE ON marco_planejamento
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER marco_planejamento_auditoria AFTER INSERT OR UPDATE OR DELETE ON marco_planejamento
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER marco_planejamento_sem_exclusao BEFORE DELETE ON marco_planejamento
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER acao_acompanhamento_controle BEFORE INSERT OR UPDATE ON acao_acompanhamento
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER acao_acompanhamento_auditoria AFTER INSERT OR UPDATE OR DELETE ON acao_acompanhamento
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER acao_acompanhamento_sem_exclusao BEFORE DELETE ON acao_acompanhamento
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER acao_stakeholder_controle BEFORE INSERT OR UPDATE ON acao_stakeholder
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER acao_stakeholder_auditoria AFTER INSERT OR UPDATE OR DELETE ON acao_stakeholder
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER acao_stakeholder_sem_exclusao BEFORE DELETE ON acao_stakeholder
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER risco_controle BEFORE INSERT OR UPDATE ON risco
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER risco_auditoria AFTER INSERT OR UPDATE OR DELETE ON risco
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER risco_sem_exclusao BEFORE DELETE ON risco
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER risco_avaliacao_controle BEFORE INSERT OR UPDATE ON risco_avaliacao
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER risco_avaliacao_auditoria AFTER INSERT OR UPDATE OR DELETE ON risco_avaliacao
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER risco_avaliacao_sem_exclusao BEFORE DELETE ON risco_avaliacao
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER risco_gatilho_controle BEFORE INSERT OR UPDATE ON risco_gatilho
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER risco_gatilho_auditoria AFTER INSERT OR UPDATE OR DELETE ON risco_gatilho
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER risco_gatilho_sem_exclusao BEFORE DELETE ON risco_gatilho
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER risco_gatilho_registro_controle BEFORE INSERT OR UPDATE ON risco_gatilho_registro
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER risco_gatilho_registro_auditoria AFTER INSERT OR UPDATE OR DELETE ON risco_gatilho_registro
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER risco_gatilho_registro_sem_exclusao BEFORE DELETE ON risco_gatilho_registro
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER risco_resposta_controle BEFORE INSERT OR UPDATE ON risco_resposta
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER risco_resposta_auditoria AFTER INSERT OR UPDATE OR DELETE ON risco_resposta
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER risco_resposta_sem_exclusao BEFORE DELETE ON risco_resposta
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
CREATE TRIGGER risco_stakeholder_controle BEFORE INSERT OR UPDATE ON risco_stakeholder
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER risco_stakeholder_auditoria AFTER INSERT OR UPDATE OR DELETE ON risco_stakeholder
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER risco_stakeholder_sem_exclusao BEFORE DELETE ON risco_stakeholder
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint
-- Campos que identificam o registro não mudam depois de criados (código, plano, projeto).
CREATE FUNCTION proteger_campos_fixos() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_campo text;
BEGIN
  FOREACH v_campo IN ARRAY TG_ARGV LOOP
    IF (to_jsonb(NEW) -> v_campo) IS DISTINCT FROM (to_jsonb(OLD) -> v_campo) THEN
      RAISE EXCEPTION 'O registro não pode mudar de % depois de criado.', replace(replace(v_campo, '_id', ''), '_', ' ')
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER plano_acao_campos_fixos BEFORE UPDATE ON plano_acao
  FOR EACH ROW EXECUTE FUNCTION proteger_campos_fixos('projeto_tema_id');
--> statement-breakpoint
CREATE TRIGGER plano_eixo_campos_fixos BEFORE UPDATE ON plano_eixo
  FOR EACH ROW EXECUTE FUNCTION proteger_campos_fixos('plano_acao_id');
--> statement-breakpoint
CREATE TRIGGER acao_campos_fixos BEFORE UPDATE ON acao
  FOR EACH ROW EXECUTE FUNCTION proteger_campos_fixos('plano_acao_id', 'codigo');
--> statement-breakpoint
CREATE TRIGGER acao_marco_campos_fixos BEFORE UPDATE ON acao_marco
  FOR EACH ROW EXECUTE FUNCTION proteger_campos_fixos('acao_id', 'codigo');
--> statement-breakpoint
CREATE TRIGGER risco_campos_fixos BEFORE UPDATE ON risco
  FOR EACH ROW EXECUTE FUNCTION proteger_campos_fixos('projeto_tema_id', 'codigo');
--> statement-breakpoint
CREATE TRIGGER risco_gatilho_campos_fixos BEFORE UPDATE ON risco_gatilho
  FOR EACH ROW EXECUTE FUNCTION proteger_campos_fixos('risco_id');
--> statement-breakpoint
CREATE TRIGGER risco_resposta_campos_fixos BEFORE UPDATE ON risco_resposta
  FOR EACH ROW EXECUTE FUNCTION proteger_campos_fixos('risco_id');
--> statement-breakpoint
-- Registros de histórico (decisões, acompanhamentos, avaliações, ocorrências de
-- gatilhos) são preservados: corrige-se com um novo registro. As colunas
-- calculadas (criticidade e classificação) ainda não têm valor neste gatilho e
-- derivam da probabilidade e do impacto, que são comparados.
CREATE FUNCTION proteger_historico() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_livres text[] := ARRAY['arquivado_em', 'atualizado_em', 'atualizado_por', 'criticidade', 'classificacao'];
BEGIN
  IF (to_jsonb(NEW) - v_livres) IS DISTINCT FROM (to_jsonb(OLD) - v_livres) THEN
    RAISE EXCEPTION 'Os registros de histórico não são alterados; registre um novo.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER plano_acao_decisao_historico BEFORE UPDATE ON plano_acao_decisao
  FOR EACH ROW EXECUTE FUNCTION proteger_historico();
--> statement-breakpoint
CREATE TRIGGER acao_acompanhamento_historico BEFORE UPDATE ON acao_acompanhamento
  FOR EACH ROW EXECUTE FUNCTION proteger_historico();
--> statement-breakpoint
CREATE TRIGGER risco_avaliacao_historico BEFORE UPDATE ON risco_avaliacao
  FOR EACH ROW EXECUTE FUNCTION proteger_historico();
--> statement-breakpoint
CREATE TRIGGER risco_gatilho_registro_historico BEFORE UPDATE ON risco_gatilho_registro
  FOR EACH ROW EXECUTE FUNCTION proteger_historico();
--> statement-breakpoint
CREATE TRIGGER acao_stakeholder_protegida BEFORE UPDATE ON acao_stakeholder
  FOR EACH ROW EXECUTE FUNCTION proteger_ligacao('observacao');
--> statement-breakpoint
CREATE TRIGGER risco_stakeholder_protegida BEFORE UPDATE ON risco_stakeholder
  FOR EACH ROW EXECUTE FUNCTION proteger_ligacao('observacao');
--> statement-breakpoint
-- Fluxo das versões do plano (D-072): rascunho → em aprovação → aprovada ou
-- rejeitada; em aprovação → rascunho (devolvida para ajustes); ao aprovar, a
-- versão vigente anterior passa a substituída. Versões decididas não mudam.
CREATE FUNCTION controlar_versao_plano() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.situacao <> 'rascunho' THEN
      RAISE EXCEPTION 'Toda versão do plano nasce como rascunho.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.plano_acao_id IS DISTINCT FROM OLD.plano_acao_id OR NEW.numero_versao IS DISTINCT FROM OLD.numero_versao THEN
    RAISE EXCEPTION 'A versão não pode mudar de plano nem de número.' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.situacao IN ('aprovada', 'rejeitada', 'substituida') THEN
    IF OLD.situacao = 'aprovada' AND NEW.situacao = 'substituida'
       AND NEW.motivo_alteracao IS NOT DISTINCT FROM OLD.motivo_alteracao
       AND NEW.parecer IS NOT DISTINCT FROM OLD.parecer
       AND EXISTS (
         SELECT 1 FROM plano_acao_versao
         WHERE plano_acao_id = OLD.plano_acao_id AND situacao = 'em_aprovacao' AND id <> OLD.id
       ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Versões decididas não podem ser alteradas; para mudar o plano, crie uma nova versão.'
      USING ERRCODE = 'P0001';
  END IF;
  IF OLD.situacao = 'em_aprovacao' THEN
    IF NEW.situacao NOT IN ('rascunho', 'aprovada', 'rejeitada') THEN
      RAISE EXCEPTION 'A versão em aprovação só pode ser aprovada, rejeitada ou devolvida para ajustes.'
        USING ERRCODE = 'P0001';
    END IF;
    IF NEW.motivo_alteracao IS DISTINCT FROM OLD.motivo_alteracao THEN
      RAISE EXCEPTION 'Devolva a versão para ajustes antes de alterá-la.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.situacao IN ('aprovada', 'rejeitada') THEN
      NEW.decidida_por := coalesce(NEW.decidida_por, usuario_da_sessao());
      NEW.decidida_em := coalesce(NEW.decidida_em, now());
      IF NEW.situacao = 'aprovada' THEN
        UPDATE plano_acao_versao SET situacao = 'substituida'
        WHERE plano_acao_id = NEW.plano_acao_id AND situacao = 'aprovada' AND id <> NEW.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  -- Rascunho.
  IF NEW.situacao = 'em_aprovacao' THEN
    IF NEW.numero_versao > 1 AND length(trim(coalesce(NEW.motivo_alteracao, ''))) = 0 THEN
      RAISE EXCEPTION 'Informe o motivo da alteração antes de enviar a nova versão para aprovação.'
        USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM acao_planejamento WHERE plano_acao_versao_id = NEW.id AND arquivado_em IS NULL
    ) THEN
      RAISE EXCEPTION 'Inclua pelo menos uma ação antes de enviar a versão para aprovação.' USING ERRCODE = 'P0001';
    END IF;
    NEW.proposta_por := usuario_da_sessao();
    NEW.proposta_em := now();
  ELSIF NEW.situacao <> 'rascunho' THEN
    RAISE EXCEPTION 'Envie a versão para aprovação antes de decidir sobre ela.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER plano_acao_versao_fluxo BEFORE INSERT OR UPDATE ON plano_acao_versao
  FOR EACH ROW EXECUTE FUNCTION controlar_versao_plano();
--> statement-breakpoint
-- O planejamento (ações e marcos) só muda na versão em rascunho, e sempre dentro do mesmo plano.
CREATE FUNCTION proteger_planejamento() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_situacao situacao_versao_plano;
  v_plano uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.plano_acao_versao_id IS DISTINCT FROM OLD.plano_acao_versao_id THEN
    RAISE EXCEPTION 'O planejamento não pode mudar de versão.' USING ERRCODE = 'P0001';
  END IF;
  SELECT situacao, plano_acao_id INTO v_situacao, v_plano FROM plano_acao_versao WHERE id = NEW.plano_acao_versao_id;
  IF v_situacao IS DISTINCT FROM 'rascunho' THEN
    RAISE EXCEPTION 'Só a versão em rascunho pode ser alterada; para mudar o planejamento, crie uma nova versão.'
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_TABLE_NAME = 'acao_planejamento' THEN
    IF TG_OP = 'UPDATE' AND NEW.acao_id IS DISTINCT FROM OLD.acao_id THEN
      RAISE EXCEPTION 'O planejamento não pode mudar de ação.' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT plano_acao_id FROM acao WHERE id = NEW.acao_id) IS DISTINCT FROM v_plano THEN
      RAISE EXCEPTION 'A ação e a versão devem ser do mesmo plano.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.eixo_id IS NOT NULL AND (SELECT plano_acao_id FROM plano_eixo WHERE id = NEW.eixo_id) IS DISTINCT FROM v_plano THEN
      RAISE EXCEPTION 'O pilar ou eixo deve ser do mesmo plano.' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF TG_OP = 'UPDATE' AND NEW.marco_id IS DISTINCT FROM OLD.marco_id THEN
      RAISE EXCEPTION 'O planejamento não pode mudar de marco.' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT a.plano_acao_id FROM acao_marco m JOIN acao a ON a.id = m.acao_id WHERE m.id = NEW.marco_id)
       IS DISTINCT FROM v_plano THEN
      RAISE EXCEPTION 'O marco e a versão devem ser do mesmo plano.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER acao_planejamento_rascunho BEFORE INSERT OR UPDATE ON acao_planejamento
  FOR EACH ROW EXECUTE FUNCTION proteger_planejamento();
--> statement-breakpoint
CREATE TRIGGER marco_planejamento_rascunho BEFORE INSERT OR UPDATE ON marco_planejamento
  FOR EACH ROW EXECUTE FUNCTION proteger_planejamento();
--> statement-breakpoint
-- O acompanhamento não exige aprovação, mas vale para as ações da versão vigente;
-- o marco registrado deve ser da própria ação.
CREATE FUNCTION verificar_acompanhamento_acao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM acao_planejamento ap
    JOIN plano_acao_versao v ON v.id = ap.plano_acao_versao_id
    WHERE ap.acao_id = NEW.acao_id AND ap.arquivado_em IS NULL AND v.situacao = 'aprovada'
  ) THEN
    RAISE EXCEPTION 'O acompanhamento é registrado nas ações da versão vigente (aprovada) do plano.'
      USING ERRCODE = 'P0001';
  END IF;
  IF NEW.marco_id IS NOT NULL AND (SELECT acao_id FROM acao_marco WHERE id = NEW.marco_id) IS DISTINCT FROM NEW.acao_id THEN
    RAISE EXCEPTION 'O marco deve ser da mesma ação.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER acao_acompanhamento_vigente BEFORE INSERT ON acao_acompanhamento
  FOR EACH ROW EXECUTE FUNCTION verificar_acompanhamento_acao();
--> statement-breakpoint
-- O pilar ou eixo do risco é o do plano do mesmo projeto ou tema.
CREATE FUNCTION verificar_eixo_do_risco() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.eixo_id IS NOT NULL AND (
    SELECT p.projeto_tema_id FROM plano_eixo e JOIN plano_acao p ON p.id = e.plano_acao_id WHERE e.id = NEW.eixo_id
  ) IS DISTINCT FROM NEW.projeto_tema_id THEN
    RAISE EXCEPTION 'O pilar ou eixo deve ser do plano do mesmo projeto ou tema.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER risco_eixo_coerente BEFORE INSERT OR UPDATE ON risco
  FOR EACH ROW EXECUTE FUNCTION verificar_eixo_do_risco();
--> statement-breakpoint
-- Todo risco ativo tem pelo menos uma avaliação inerente (verificado ao fim da transação).
CREATE FUNCTION verificar_risco_avaliado() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'risco' THEN
    v_id := NEW.id;
  ELSE
    v_id := NEW.risco_id;
  END IF;
  IF EXISTS (SELECT 1 FROM risco WHERE id = v_id AND arquivado_em IS NULL)
     AND NOT EXISTS (
       SELECT 1 FROM risco_avaliacao WHERE risco_id = v_id AND tipo = 'inerente' AND arquivado_em IS NULL
     ) THEN
    RAISE EXCEPTION 'Registre a avaliação do risco inerente (probabilidade, impacto e justificativa).'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER risco_com_avaliacao AFTER INSERT OR UPDATE ON risco
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verificar_risco_avaliado();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER risco_avaliacao_mantem_inerente AFTER UPDATE ON risco_avaliacao
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verificar_risco_avaliado();
