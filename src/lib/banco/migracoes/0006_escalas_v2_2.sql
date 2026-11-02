CREATE TYPE "public"."dimensao_rubrica" AS ENUM('poder', 'interesse', 'posicionamento');--> statement-breakpoint
CREATE TYPE "public"."escala_poder_interesse" AS ENUM('demonstracao_numerica', 'binaria_historica', 'ordinal_tres_niveis');--> statement-breakpoint
CREATE TYPE "public"."escala_posicionamento" AS ENUM('cinco_categorias', 'tres_categorias');--> statement-breakpoint
CREATE TYPE "public"."natureza_alteracao" AS ENUM('substantiva', 'editorial');--> statement-breakpoint
CREATE TYPE "public"."natureza_posicionamento" AS ENUM('manifestacao_formal', 'informacao_informal', 'percepcao_consultor');--> statement-breakpoint
CREATE TYPE "public"."nivel_avaliacao" AS ENUM('alto', 'medio', 'baixo');--> statement-breakpoint
CREATE TYPE "public"."situacao_ressalvas" AS ENUM('ha_ressalvas', 'nao_identificadas', 'informacao_insuficiente');--> statement-breakpoint
CREATE TABLE "rubrica_nivel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metodologia_versao_id" uuid NOT NULL,
	"dimensao" "dimensao_rubrica" NOT NULL,
	"nivel" text NOT NULL,
	"criterio_orientador" text NOT NULL,
	"bases_tipicas" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	"arquivado_em" timestamp with time zone,
	CONSTRAINT "rubrica_nivel_unica" UNIQUE("metodologia_versao_id","dimensao","nivel"),
	CONSTRAINT "rubrica_nivel_valido" CHECK (("rubrica_nivel"."dimensao" in ('poder', 'interesse') and "rubrica_nivel"."nivel" in ('alto', 'medio', 'baixo', 'nao_avaliado'))
        or ("rubrica_nivel"."dimensao" = 'posicionamento' and "rubrica_nivel"."nivel" in ('favoravel', 'neutro', 'contrario', 'nao_avaliado'))),
	CONSTRAINT "rubrica_nivel_criterio_preenchido" CHECK (length(trim("rubrica_nivel"."criterio_orientador")) > 0)
);
--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD COLUMN "nivel_poder" "nivel_avaliacao";--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD COLUMN "nivel_interesse" "nivel_avaliacao";--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD COLUMN "justificativa_poder" text;--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD COLUMN "justificativa_interesse" text;--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD COLUMN "justificativa_posicionamento" text;--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD COLUMN "natureza_posicionamento" "natureza_posicionamento";--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD COLUMN "situacao_ressalvas" "situacao_ressalvas";--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD COLUMN "descricao_ressalvas" text;--> statement-breakpoint
ALTER TABLE "avaliacao_versao" ADD COLUMN "alertas_reconhecidos" text[];--> statement-breakpoint
ALTER TABLE "evidencia" ADD COLUMN "evidencia_origem_id" uuid;--> statement-breakpoint
-- As metodologias já registradas (Etapa 2A) recebem as escalas de demonstração,
-- sem conversão; o padrão das novas passa a ser a escala V2.2 (T-1, T-2).
ALTER TABLE "metodologia_versao" ADD COLUMN "escala_poder_interesse" "escala_poder_interesse" DEFAULT 'demonstracao_numerica' NOT NULL;--> statement-breakpoint
ALTER TABLE "metodologia_versao" ALTER COLUMN "escala_poder_interesse" SET DEFAULT 'ordinal_tres_niveis';--> statement-breakpoint
ALTER TABLE "metodologia_versao" ADD COLUMN "escala_posicionamento" "escala_posicionamento" DEFAULT 'cinco_categorias' NOT NULL;--> statement-breakpoint
ALTER TABLE "metodologia_versao" ALTER COLUMN "escala_posicionamento" SET DEFAULT 'tres_categorias';--> statement-breakpoint
ALTER TABLE "metodologia_versao" ADD COLUMN "metodologia_anterior_id" uuid;--> statement-breakpoint
ALTER TABLE "metodologia_versao" ADD COLUMN "natureza_alteracao" "natureza_alteracao";--> statement-breakpoint
ALTER TABLE "metodologia_versao" ADD COLUMN "justificativa_natureza" text;--> statement-breakpoint
ALTER TABLE "metodologia_versao" ADD COLUMN "natureza_aprovada_por" uuid;--> statement-breakpoint
ALTER TABLE "metodologia_versao" ADD COLUMN "natureza_aprovada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "metodologia_versao" ADD COLUMN "equivalente_posicionamento_a" uuid;--> statement-breakpoint
ALTER TABLE "metodologia_versao" ADD COLUMN "justificativa_equivalencia" text;--> statement-breakpoint
ALTER TABLE "rubrica_nivel" ADD CONSTRAINT "rubrica_nivel_metodologia_versao_id_metodologia_versao_id_fk" FOREIGN KEY ("metodologia_versao_id") REFERENCES "public"."metodologia_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubrica_nivel" ADD CONSTRAINT "rubrica_nivel_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubrica_nivel" ADD CONSTRAINT "rubrica_nivel_atualizado_por_usuario_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_evidencia_origem_id_evidencia_id_fk" FOREIGN KEY ("evidencia_origem_id") REFERENCES "public"."evidencia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodologia_versao" ADD CONSTRAINT "metodologia_versao_metodologia_anterior_id_metodologia_versao_id_fk" FOREIGN KEY ("metodologia_anterior_id") REFERENCES "public"."metodologia_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodologia_versao" ADD CONSTRAINT "metodologia_versao_natureza_aprovada_por_usuario_id_fk" FOREIGN KEY ("natureza_aprovada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodologia_versao" ADD CONSTRAINT "metodologia_versao_equivalente_posicionamento_a_metodologia_versao_id_fk" FOREIGN KEY ("equivalente_posicionamento_a") REFERENCES "public"."metodologia_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Gatilhos comuns da tabela de rubricas (funções criadas em 0001_gatilhos.sql).
CREATE TRIGGER rubrica_nivel_controle BEFORE INSERT OR UPDATE ON rubrica_nivel
  FOR EACH ROW EXECUTE FUNCTION preencher_controle();
--> statement-breakpoint
CREATE TRIGGER rubrica_nivel_auditoria AFTER INSERT OR UPDATE OR DELETE ON rubrica_nivel
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
--> statement-breakpoint
CREATE TRIGGER rubrica_nivel_sem_exclusao BEFORE DELETE ON rubrica_nivel
  FOR EACH ROW EXECUTE FUNCTION impedir_exclusao();
--> statement-breakpoint

-- Rubricas só podem ser incluídas ou alteradas enquanto a metodologia for rascunho.
CREATE FUNCTION proteger_rubrica() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT situacao FROM metodologia_versao WHERE id = NEW.metodologia_versao_id) <> 'rascunho'
     OR (TG_OP = 'UPDATE' AND (SELECT situacao FROM metodologia_versao WHERE id = OLD.metodologia_versao_id) <> 'rascunho') THEN
    RAISE EXCEPTION 'As rubricas de uma metodologia vigente ou encerrada não podem ser alteradas; crie uma nova versão da metodologia.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER rubrica_nivel_protegida BEFORE INSERT OR UPDATE ON rubrica_nivel
  FOR EACH ROW EXECUTE FUNCTION proteger_rubrica();
--> statement-breakpoint

-- Critérios com notas existem só na metodologia de demonstração.
CREATE OR REPLACE FUNCTION proteger_criterio() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT situacao FROM metodologia_versao WHERE id = NEW.metodologia_versao_id) <> 'rascunho'
     OR (TG_OP = 'UPDATE' AND (SELECT situacao FROM metodologia_versao WHERE id = OLD.metodologia_versao_id) <> 'rascunho') THEN
    RAISE EXCEPTION 'Os critérios de uma metodologia vigente ou encerrada não podem ser alterados; crie uma nova versão da metodologia.'
      USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT escala_poder_interesse FROM metodologia_versao WHERE id = NEW.metodologia_versao_id) <> 'demonstracao_numerica' THEN
    RAISE EXCEPTION 'Metodologias da escala V2.2 usam rubricas de níveis, sem critérios com notas.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

-- Metodologia: nasce como rascunho; entra em vigor com os requisitos da sua
-- escala (critérios na demonstração; rubricas na V2.2) e, se substitui outra
-- versão, com a natureza da alteração registrada e aprovada (D-064). Alteração
-- estrutural nunca pode ser classificada como editorial. Vigente, só pode ser
-- encerrada; encerrada, não muda mais.
CREATE OR REPLACE FUNCTION proteger_metodologia() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_anterior metodologia_versao%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.situacao <> 'rascunho' THEN
    RAISE EXCEPTION 'Toda metodologia nasce como rascunho.' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.situacao = 'encerrada' THEN
    IF (to_jsonb(OLD) - 'atualizado_em' - 'atualizado_por')
       <> (to_jsonb(NEW) - 'atualizado_em' - 'atualizado_por') THEN
      RAISE EXCEPTION 'Uma metodologia encerrada não pode ser alterada.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.situacao = 'vigente' THEN
    IF NEW.situacao = 'rascunho'
       OR (to_jsonb(OLD) - 'atualizado_em' - 'atualizado_por' - 'situacao' - 'vigente_ate')
          <> (to_jsonb(NEW) - 'atualizado_em' - 'atualizado_por' - 'situacao' - 'vigente_ate') THEN
      RAISE EXCEPTION 'Uma metodologia vigente não pode ser alterada; crie uma nova versão.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.situacao = 'encerrada' THEN
      NEW.vigente_ate := coalesce(NEW.vigente_ate, current_date);
    END IF;
    RETURN NEW;
  END IF;

  -- Rascunho (inclusão ou alteração): a aprovação da natureza registra quem e quando.
  IF NEW.natureza_alteracao IS NOT NULL THEN
    NEW.natureza_aprovada_por := coalesce(NEW.natureza_aprovada_por, usuario_da_sessao());
    NEW.natureza_aprovada_em := coalesce(NEW.natureza_aprovada_em, now());
  END IF;
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.situacao = 'encerrada' THEN
    RAISE EXCEPTION 'Uma metodologia em rascunho não pode ser encerrada; ela ainda não entrou em vigor.' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.situacao = 'vigente' THEN
    IF NEW.escala_poder_interesse = 'binaria_historica' THEN
      RAISE EXCEPTION 'A escala binária histórica serve só para registros históricos e não entra em vigor para novas avaliações.'
        USING ERRCODE = 'P0001';
    ELSIF NEW.escala_poder_interesse = 'ordinal_tres_niveis' THEN
      IF NOT EXISTS (SELECT 1 FROM rubrica_nivel WHERE metodologia_versao_id = NEW.id AND dimensao = 'poder' AND arquivado_em IS NULL)
         OR NOT EXISTS (SELECT 1 FROM rubrica_nivel WHERE metodologia_versao_id = NEW.id AND dimensao = 'interesse' AND arquivado_em IS NULL)
         OR NOT EXISTS (SELECT 1 FROM rubrica_nivel WHERE metodologia_versao_id = NEW.id AND dimensao = 'posicionamento' AND arquivado_em IS NULL) THEN
        RAISE EXCEPTION 'A metodologia V2.2 precisa das rubricas de poder, interesse e posicionamento para entrar em vigor.'
          USING ERRCODE = 'P0001';
      END IF;
    ELSIF NOT EXISTS (SELECT 1 FROM criterio_avaliacao WHERE metodologia_versao_id = NEW.id AND dimensao = 'poder' AND arquivado_em IS NULL)
       OR NOT EXISTS (SELECT 1 FROM criterio_avaliacao WHERE metodologia_versao_id = NEW.id AND dimensao = 'interesse' AND arquivado_em IS NULL) THEN
      RAISE EXCEPTION 'A metodologia precisa de pelo menos um critério de poder e um de interesse para entrar em vigor.' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.metodologia_anterior_id IS NOT NULL THEN
      IF NEW.natureza_alteracao IS NULL OR coalesce(length(trim(NEW.justificativa_natureza)), 0) = 0 THEN
        RAISE EXCEPTION 'Registre a natureza da alteração (substantiva ou editorial) e a justificativa antes de colocar a nova versão da metodologia em vigor.'
          USING ERRCODE = 'P0001';
      END IF;
      IF NEW.natureza_aprovada_por IS NULL THEN
        RAISE EXCEPTION 'Registre quem aprovou a natureza da alteração.' USING ERRCODE = 'P0001';
      END IF;
      IF NEW.natureza_alteracao = 'editorial' THEN
        SELECT * INTO v_anterior FROM metodologia_versao WHERE id = NEW.metodologia_anterior_id;
        IF v_anterior.escala_poder_interesse <> NEW.escala_poder_interesse
           OR v_anterior.escala_posicionamento <> NEW.escala_posicionamento
           OR EXISTS (
             (SELECT dimensao::text, nivel FROM rubrica_nivel WHERE metodologia_versao_id = NEW.id AND arquivado_em IS NULL
              EXCEPT SELECT dimensao::text, nivel FROM rubrica_nivel WHERE metodologia_versao_id = v_anterior.id AND arquivado_em IS NULL)
             UNION ALL
             (SELECT dimensao::text, nivel FROM rubrica_nivel WHERE metodologia_versao_id = v_anterior.id AND arquivado_em IS NULL
              EXCEPT SELECT dimensao::text, nivel FROM rubrica_nivel WHERE metodologia_versao_id = NEW.id AND arquivado_em IS NULL))
           OR EXISTS (
             (SELECT dimensao::text, nome, escala_minima, escala_maxima, peso FROM criterio_avaliacao
              WHERE metodologia_versao_id = NEW.id AND arquivado_em IS NULL
              EXCEPT SELECT dimensao::text, nome, escala_minima, escala_maxima, peso FROM criterio_avaliacao
              WHERE metodologia_versao_id = v_anterior.id AND arquivado_em IS NULL)
             UNION ALL
             (SELECT dimensao::text, nome, escala_minima, escala_maxima, peso FROM criterio_avaliacao
              WHERE metodologia_versao_id = v_anterior.id AND arquivado_em IS NULL
              EXCEPT SELECT dimensao::text, nome, escala_minima, escala_maxima, peso FROM criterio_avaliacao
              WHERE metodologia_versao_id = NEW.id AND arquivado_em IS NULL)) THEN
          RAISE EXCEPTION 'Alteração estrutural (escala, níveis ou critérios) é sempre substantiva; não pode ser classificada como editorial.'
            USING ERRCODE = 'P0001';
        END IF;
      END IF;
    END IF;

    IF NEW.equivalente_posicionamento_a IS NOT NULL AND coalesce(length(trim(NEW.justificativa_equivalencia)), 0) = 0 THEN
      RAISE EXCEPTION 'Justifique a equivalência das definições de posicionamento.' USING ERRCODE = 'P0001';
    END IF;

    NEW.vigente_desde := coalesce(NEW.vigente_desde, current_date);
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint

-- Escala de cada versão (bloqueios técnicos): toda nova versão usa uma
-- metodologia; os valores respeitam a escala dessa metodologia (T17, T20 a T22).
-- Versões publicadas são protegidas por proteger_versao_avaliacao().
CREATE FUNCTION verificar_escala_versao() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_escala_pi escala_poder_interesse;
  v_escala_pos escala_posicionamento;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.situacao <> 'rascunho' THEN
    RETURN NEW;
  END IF;
  IF NEW.metodologia_versao_id IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Não há metodologia vigente: coloque uma metodologia em vigor antes de iniciar a avaliação.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  SELECT escala_poder_interesse, escala_posicionamento INTO v_escala_pi, v_escala_pos
  FROM metodologia_versao WHERE id = NEW.metodologia_versao_id;

  IF v_escala_pos = 'tres_categorias' AND NEW.posicionamento IN ('parcialmente_favoravel', 'parcialmente_contrario') THEN
    RAISE EXCEPTION 'As categorias parciais existem só no histórico; use Favorável, Neutro, Contrário ou "Não avaliado".'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_escala_pi = 'ordinal_tres_niveis' AND (NEW.poder IS NOT NULL OR NEW.interesse IS NOT NULL) THEN
    RAISE EXCEPTION 'Na escala V2.2, poder e interesse são níveis (Baixo, Médio ou Alto), sem pontuação de 0 a 100.'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_escala_pi = 'binaria_historica' AND (NEW.nivel_poder = 'medio' OR NEW.nivel_interesse = 'medio') THEN
    RAISE EXCEPTION 'A escala binária histórica não tem o nível Médio.' USING ERRCODE = 'P0001';
  END IF;
  IF v_escala_pi = 'demonstracao_numerica' AND (NEW.nivel_poder IS NOT NULL OR NEW.nivel_interesse IS NOT NULL) THEN
    RAISE EXCEPTION 'A metodologia de demonstração usa notas por critério, sem níveis.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER avaliacao_versao_escala BEFORE INSERT OR UPDATE ON avaliacao_versao
  FOR EACH ROW EXECUTE FUNCTION verificar_escala_versao();
--> statement-breakpoint

-- Versão de avaliação: nasce como rascunho; publicada, só pode passar a
-- "substituída". A publicação exige justificativa e data de referência. Na
-- metodologia de demonstração, também evidência e validação institucional
-- (regras da Etapa 2A). Na V2.2, só a rastreabilidade mínima: justificativa de
-- cada dimensão classificada e natureza da informação do posicionamento; as
-- regras de interpretação são alertas na aplicação (D-067, D-068).
CREATE OR REPLACE FUNCTION proteger_versao_avaliacao() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_tipo tipo_stakeholder;
  v_escala_pi escala_poder_interesse;
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
    SELECT escala_poder_interesse INTO v_escala_pi FROM metodologia_versao WHERE id = NEW.metodologia_versao_id;
    IF v_escala_pi = 'ordinal_tres_niveis' THEN
      IF NEW.nivel_poder IS NOT NULL AND coalesce(length(trim(NEW.justificativa_poder)), 0) = 0 THEN
        RAISE EXCEPTION 'Justifique o nível de poder antes de publicar.' USING ERRCODE = 'P0001';
      END IF;
      IF NEW.nivel_interesse IS NOT NULL AND coalesce(length(trim(NEW.justificativa_interesse)), 0) = 0 THEN
        RAISE EXCEPTION 'Justifique o nível de interesse antes de publicar.' USING ERRCODE = 'P0001';
      END IF;
      IF NEW.posicionamento IS NOT NULL THEN
        IF coalesce(length(trim(NEW.justificativa_posicionamento)), 0) = 0 THEN
          RAISE EXCEPTION 'Justifique o posicionamento antes de publicar.' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.natureza_posicionamento IS NULL THEN
          RAISE EXCEPTION 'Indique a natureza da informação do posicionamento (manifestação formal, informação informal ou percepção do consultor).'
            USING ERRCODE = 'P0001';
        END IF;
      END IF;
    ELSIF NOT EXISTS (SELECT 1 FROM evidencia WHERE avaliacao_versao_id = NEW.id AND arquivado_em IS NULL) THEN
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
    IF coalesce(v_escala_pi, 'demonstracao_numerica') <> 'ordinal_tres_niveis' THEN
      SELECT s.tipo INTO v_tipo
      FROM avaliacao a JOIN stakeholder s ON s.id = a.stakeholder_id
      WHERE a.id = NEW.avaliacao_id;
      IF v_tipo = 'instituicao' AND NEW.posicionamento IS NOT NULL
         AND coalesce(length(trim(NEW.validacao_institucional)), 0) = 0 THEN
        RAISE EXCEPTION 'Para atribuir posicionamento a uma instituição, informe a validação institucional (fonte e justificativa).'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
    NEW.publicada_em := now();
    NEW.avaliador_id := coalesce(NEW.avaliador_id, usuario_da_sessao());
    NEW.proxima_revisao := (NEW.data_referencia + interval '1 year')::date;
  END IF;
  RETURN NEW;
END
$$;
