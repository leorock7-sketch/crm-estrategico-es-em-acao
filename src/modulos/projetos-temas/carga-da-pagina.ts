/**
 * Carga da página de projeto ou tema (P-071, E2).
 *
 * Antes, a página buscava os dados em cerca de oito etapas encadeadas e 26 transações (uma por
 * consulta); cada transação custa várias idas e voltas ao banco, e na hospedagem cada ida e volta
 * custa cerca de 0,17 s. Agora as leituras são distribuídas em cinco grupos independentes, iniciados
 * juntos, cada um numa única transação com a identidade do usuário: as regras de acesso do banco (RLS)
 * valem para todas as consultas, exatamente como antes. Dentro de uma transação as consultas não se
 * sobrepõem (driver sem consultas preparadas), por isso os grupos são equilibrados em número de
 * consultas e a busca de nomes do histórico é feita numa única consulta.
 *
 * Os grupos não dependem de o projeto existir: se ele não for visível ao usuário, as consultas só
 * devolvem o que as regras de acesso permitem, e a página mostra "não encontrado" como antes. As
 * fichas só são exibidas a quem tem permissão de ver, como antes.
 */
import type { Banco } from "@/lib/banco/conexao";
import { permissaoDoUsuarioDaSessao } from "@/modulos/acesso/permissoes";
import { fichasDoContexto } from "@/modulos/avaliacoes/consultas";
import { iniciativasDoProjetoTema } from "@/modulos/iniciativas/consultas";
import { interacoesDoProjetoTema, resumoDoProjetoTema } from "@/modulos/interacoes/consultas";
import { listarPlanos } from "@/modulos/plano-acao/consultas";
import { resumoRiscosDoProjetoTema } from "@/modulos/riscos/consultas";
import { idsCitadosNoHistorico, nomesDosRegistrosEmUmaConsulta } from "@/modulos/stakeholders/consultas";
import {
  historicoDoProjetoTema,
  listarParticipantes,
  listarStakeholdersDoContexto,
  obterProjetoTema,
  opcoesComites,
  opcoesStakeholders,
} from "./consultas";

export async function carregarPaginaProjetoTema(banco: Banco, id: string, usuario: { id: string; administrador?: boolean }, hoje: string) {
  const [nucleo, historicoEAtividades, stakeholders, fichas, planoERiscos] = await Promise.all([
    banco.transaction(async (tx) => {
      const [projeto, participantes, comites, permissao] = await Promise.all([
        obterProjetoTema(tx, id),
        listarParticipantes(tx, id),
        opcoesComites(tx),
        permissaoDoUsuarioDaSessao(tx, usuario, id),
      ]);
      return { projeto, participantes, comites, permissao };
    }),
    banco.transaction(async (tx) => {
      const historico = await historicoDoProjetoTema(tx, id);
      const [nomes, iniciativas, interacoes, resumo] = await Promise.all([
        nomesDosRegistrosEmUmaConsulta(tx, idsCitadosNoHistorico(historico)),
        iniciativasDoProjetoTema(tx, id),
        interacoesDoProjetoTema(tx, id),
        resumoDoProjetoTema(tx, id, hoje),
      ]);
      return { historico, nomes, atividades: { iniciativas, interacoes, resumo } };
    }),
    banco.transaction(async (tx) => {
      const [lista, opcoes] = await Promise.all([listarStakeholdersDoContexto(tx, id), opcoesStakeholders(tx)]);
      return { lista, opcoes };
    }),
    banco.transaction((tx) => fichasDoContexto(tx, id)),
    banco.transaction(async (tx) => {
      const [[plano], riscos] = await Promise.all([listarPlanos(tx, hoje, "todos", id), resumoRiscosDoProjetoTema(tx, id, hoje)]);
      return { plano, riscos };
    }),
  ]);
  return {
    projeto: nucleo.projeto,
    participantes: nucleo.participantes,
    comites: nucleo.comites,
    permissao: nucleo.permissao,
    stakeholders: stakeholders.lista,
    opcoes: stakeholders.opcoes,
    historico: historicoEAtividades.historico,
    nomes: historicoEAtividades.nomes,
    fichas: nucleo.permissao.ver ? fichas : [],
    atividades: historicoEAtividades.atividades,
    planoERiscos,
  };
}

export type DadosDaPaginaProjetoTema = Awaited<ReturnType<typeof carregarPaginaProjetoTema>>;
