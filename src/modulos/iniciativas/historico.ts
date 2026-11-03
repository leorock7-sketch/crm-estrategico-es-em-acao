/**
 * Descrição legível da trilha de auditoria de iniciativas, interações e
 * compromissos: o que foi incluído, alterado ou retirado, por quem e quando.
 */
import { inArray } from "drizzle-orm";
import type { Executor } from "@/lib/banco/conexao";
import { iniciativa, interacao, usuario } from "@/lib/banco/esquema";
import { formatarData, formatarDataHora } from "@/lib/formatacao";
import {
  ROTULOS_PRESENCA,
  ROTULOS_SITUACAO_COMPROMISSO,
  ROTULOS_SITUACAO_INTERACAO,
  ROTULOS_TIPO_INTERACAO,
} from "@/modulos/interacoes/rotulos";
import { nomesDosRegistros } from "@/modulos/stakeholders/consultas";
import {
  ROTULOS_PAPEL_INICIATIVA,
  ROTULOS_PRIORIDADE_INICIATIVA,
  ROTULOS_SITUACAO_INICIATIVA,
  ROTULOS_TIPO_INICIATIVA,
} from "./rotulos";

type Dados = Record<string, unknown> | null;

export type RegistroAtividade = {
  id: number;
  tabela: string;
  operacao: string;
  dadosAnteriores: unknown;
  dadosNovos: unknown;
  ocorridoEm: Date;
  usuarioNome: string | null;
};

export type AlteracaoAtividade = { campo: string; rotulo: string; antes: string; depois: string };

const ROTULOS_CAMPOS: Record<string, string> = {
  tipo: "Tipo",
  titulo: "Título",
  descricao: "Descrição",
  origem: "Origem",
  situacao: "Situação",
  prioridade: "Prioridade",
  responsavel_id: "Responsável",
  data_abertura: "Abertura",
  data_prevista_conclusao: "Previsão de conclusão",
  data_conclusao: "Conclusão",
  assunto: "Assunto",
  inicio: "Início",
  fim: "Término",
  local: "Local",
  resumo: "Resumo",
  presenca: "Presença",
  papel: "Papel",
  observacao: "Observação",
  contribuicao: "Contribuição",
  prazo: "Prazo",
  concluido_em: "Concluído em",
  data: "Data",
  registro: "Registro",
  interacao_id: "Interação",
  iniciativa_id: "Iniciativa",
  responsavel_usuario_id: "Responsável da equipe",
  responsavel_stakeholder_id: "Responsável externo",
  arquivado_em: "Arquivado em",
};

/** Campos técnicos ou que já aparecem na descrição do registro. */
const CAMPOS_OCULTOS = new Set([
  "id",
  "titulo_normalizado",
  "assunto_normalizado",
  "criado_em",
  "criado_por",
  "atualizado_em",
  "atualizado_por",
  "origem_sistema",
  "origem_id",
  "projeto_tema_id",
  "stakeholder_id",
  "usuario_id",
  "compromisso_id",
]);

const TABELAS_DE_LIGACAO = new Set([
  "iniciativa_projeto_tema",
  "iniciativa_stakeholder",
  "interacao_participante",
  "interacao_projeto_tema",
  "interacao_iniciativa",
]);

function rotuloDaLista(lista: Record<string, string>, valor: string) {
  return lista[valor] ?? valor;
}

function formatarValor(tabela: string, campo: string, valor: unknown, nomes: Map<string, string>): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const texto = String(valor);
  if (campo.endsWith("_id")) return nomes.get(texto) ?? "registro não identificado";
  if (campo === "inicio" || campo === "fim" || campo === "arquivado_em") return formatarDataHora(texto);
  if (campo.startsWith("data") || campo === "prazo" || campo === "concluido_em") return formatarData(texto);
  if (campo === "papel") return rotuloDaLista(ROTULOS_PAPEL_INICIATIVA, texto);
  if (campo === "presenca") return rotuloDaLista(ROTULOS_PRESENCA, texto);
  if (campo === "prioridade") return rotuloDaLista(ROTULOS_PRIORIDADE_INICIATIVA, texto);
  if (campo === "tipo") {
    return rotuloDaLista(tabela === "interacao" ? ROTULOS_TIPO_INTERACAO : ROTULOS_TIPO_INICIATIVA, texto);
  }
  if (campo === "situacao") {
    if (tabela === "iniciativa") return rotuloDaLista(ROTULOS_SITUACAO_INICIATIVA, texto);
    if (tabela === "interacao") return rotuloDaLista(ROTULOS_SITUACAO_INTERACAO, texto);
    return rotuloDaLista(ROTULOS_SITUACAO_COMPROMISSO, texto);
  }
  return texto;
}

/** Campos que mudaram entre duas versões do registro (na inclusão, os preenchidos). */
export function alteracoesDaAtividade(registro: RegistroAtividade, nomes: Map<string, string>): AlteracaoAtividade[] {
  if (registro.operacao === "arquivamento" || registro.operacao === "reativacao") return [];
  const antes = registro.dadosAnteriores as Dados;
  const depois = registro.dadosNovos as Dados;
  const campos = new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]);
  const alteracoes: AlteracaoAtividade[] = [];
  for (const campo of campos) {
    if (CAMPOS_OCULTOS.has(campo)) continue;
    // Nas ligações, o lado ligado já aparece na descrição.
    if (TABELAS_DE_LIGACAO.has(registro.tabela) && campo.endsWith("_id")) continue;
    const valorAntes = antes?.[campo] ?? null;
    const valorDepois = depois?.[campo] ?? null;
    if (JSON.stringify(valorAntes) === JSON.stringify(valorDepois)) continue;
    alteracoes.push({
      campo,
      rotulo: ROTULOS_CAMPOS[campo] ?? campo,
      antes: formatarValor(registro.tabela, campo, valorAntes, nomes),
      depois: formatarValor(registro.tabela, campo, valorDepois, nomes),
    });
  }
  return alteracoes;
}

/** Nome da operação; nas ligações, o arquivamento é a retirada. */
export function rotuloDaOperacao(registro: RegistroAtividade): string {
  const ligacao = TABELAS_DE_LIGACAO.has(registro.tabela);
  switch (registro.operacao) {
    case "inclusao":
      return "Inclusão";
    case "alteracao":
      return "Alteração";
    case "arquivamento":
      return ligacao ? "Retirada" : "Arquivamento";
    case "reativacao":
      return "Reativação";
    default:
      return registro.operacao;
  }
}

/** O que o registro de auditoria descreve: os dados principais ou uma ligação. */
export function descreverRegistroAtividade(registro: RegistroAtividade, nomes: Map<string, string>): string {
  const dados = (registro.dadosNovos ?? registro.dadosAnteriores) as Dados;
  const nome = (campo: string) => nomes.get(String(dados?.[campo] ?? "")) ?? "registro não identificado";
  switch (registro.tabela) {
    case "iniciativa":
      return "Dados da iniciativa";
    case "interacao":
      return "Dados da interação";
    case "compromisso":
      return "Dados do compromisso";
    case "compromisso_acompanhamento":
      return "Acompanhamento";
    case "iniciativa_projeto_tema":
    case "interacao_projeto_tema":
      return `Projeto ou tema: ${nome("projeto_tema_id")}`;
    case "iniciativa_stakeholder":
      return `Stakeholder: ${nome("stakeholder_id")} (${rotuloDaLista(ROTULOS_PAPEL_INICIATIVA, String(dados?.papel ?? ""))})`;
    case "interacao_participante":
      return `Participante: ${nome(dados?.usuario_id ? "usuario_id" : "stakeholder_id")}`;
    case "interacao_iniciativa":
      return `Iniciativa: ${nome("iniciativa_id")}`;
    default:
      return registro.tabela;
  }
}

/** Nomes dos registros citados no histórico: pessoas, instituições, projetos, usuários, iniciativas e interações. */
export async function nomesDoHistorico(banco: Executor, registros: RegistroAtividade[]): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const registro of registros) {
    for (const dados of [registro.dadosAnteriores, registro.dadosNovos]) {
      if (!dados || typeof dados !== "object") continue;
      for (const [campo, valor] of Object.entries(dados)) {
        if (campo.endsWith("_id") && typeof valor === "string") ids.add(valor);
      }
    }
  }
  const lista = [...ids];
  if (lista.length === 0) return new Map();
  const [cadastro, usuarios, iniciativas, interacoes] = await Promise.all([
    nomesDosRegistros(banco, lista),
    banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, lista)),
    banco.select({ id: iniciativa.id, nome: iniciativa.titulo }).from(iniciativa).where(inArray(iniciativa.id, lista)),
    banco.select({ id: interacao.id, nome: interacao.assunto }).from(interacao).where(inArray(interacao.id, lista)),
  ]);
  for (const item of [...usuarios, ...iniciativas, ...interacoes]) cadastro.set(item.id, item.nome);
  return cadastro;
}
