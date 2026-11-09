import Link from "next/link";
import { classeCartao, classeCelula, classeCelulaCabecalho, classeEntrada, classeBotaoPrimario, classeBotaoSecundario, classeLink, classeTabela } from "@/componentes/estilos";
import { parametrosDosFiltros, type FiltrosPainel } from "../filtros";
import type { Bloco, Indicador, LinhaPanorama } from "../indicadores";

/** A base aparece no cartão só quando difere das demais do grupo; igual em todos, fica no título do grupo. */
function CartaoIndicador({ indicador, mostrarBase }: { indicador: Indicador; mostrarBase: boolean }) {
  const destaque = indicador.atencao && indicador.valor !== 0;
  return (
    <div className={`flex flex-col gap-0.5 rounded-lg border p-3 ${destaque ? "border-amber-400 dark:border-amber-600" : "border-borda"}`}>
      <span className="text-2xl font-semibold tabular-nums">{indicador.valor}</span>
      <span className="text-sm">{indicador.rotulo}</span>
      {mostrarBase && <span className="text-xs text-texto-secundario">Base: {indicador.dataUsada}</span>}
      {indicador.nota && <span className="text-xs text-texto-secundario">{indicador.nota}</span>}
    </div>
  );
}

export function BlocoIndicadores({ bloco, children, verRegistros }: { bloco: Bloco; children?: React.ReactNode; verRegistros?: string }) {
  return (
    <section aria-labelledby={`titulo-${bloco.id}`} className={`${classeCartao} break-inside-avoid`}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`titulo-${bloco.id}`} className="text-lg font-semibold">
          {bloco.titulo}
        </h2>
        {verRegistros && (
          <Link href={verRegistros} className={`${classeLink} text-sm print:hidden`}>
            Ver registros
          </Link>
        )}
      </div>
      {bloco.descricao && <p className="mb-3 text-sm text-texto-secundario">{bloco.descricao}</p>}
      <div className="flex flex-col gap-4">
        {bloco.grupos.map((grupo) => {
          const baseComum = grupo.indicadores.every((i) => i.dataUsada === grupo.indicadores[0]?.dataUsada);
          return (
            <div key={grupo.titulo}>
              <h3 className="mb-2 text-sm font-medium text-texto-secundario">
                {grupo.titulo}
                {baseComum && <span className="ml-2 text-xs font-normal">Base: {grupo.indicadores[0]?.dataUsada}</span>}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {grupo.indicadores.map((indicador) => (
                  <CartaoIndicador key={indicador.rotulo} indicador={indicador} mostrarBase={!baseComum} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

/** Atalhos para os blocos, numa página longa. */
export function IndiceDosBlocos({ blocos }: { blocos: Bloco[] }) {
  return (
    <nav aria-label="Blocos do painel" className="flex flex-wrap gap-x-4 gap-y-1 text-sm print:hidden">
      {blocos.map((bloco) => (
        <a key={bloco.id} href={`#titulo-${bloco.id}`} className={classeLink}>
          {bloco.titulo}
        </a>
      ))}
    </nav>
  );
}

/** Tabela compacta: as quatorze colunas cabem na tela e no papel, sem rolagem lateral. */
const celulaCompacta = "border-b border-borda px-1.5 py-1.5 align-top text-xs tabular-nums print:text-[9px]";
const cabecalhoCompacto = "border-b border-borda px-1.5 py-1.5 align-bottom text-[11px] leading-tight font-semibold text-texto-secundario print:text-[9px]";

const COLUNAS_PANORAMA = [
  "Comitê", "Projetos e temas", "Iniciativas em curso", "Interações no período", "Compromissos pendentes", "Compromissos vencidos",
  "Ações da versão vigente", "Ações atrasadas", "Marcos", "Riscos B / M / A / C", "Riscos sem avaliação", "Riscos a reavaliar*", "Avaliações", "Sem avaliação",
];

function CelulasPanorama({ linha }: { linha: LinhaPanorama }) {
  const r = linha.riscosPorClassificacao;
  const valores = [
    linha.iniciativasEmCurso, linha.interacoesNoPeriodo, linha.compromissosPendentes, linha.compromissosVencidos, linha.acoesVigentes,
    linha.acoesAtrasadas, `${linha.marcosAlcancados} de ${linha.marcosPrevistos}`, `${r.baixo} / ${r.moderado} / ${r.alto} / ${r.critico}`,
    linha.riscosSemAvaliacao, linha.riscosAReavaliar, linha.stakeholdersAvaliados, linha.stakeholdersSemAvaliacao,
  ];
  return (
    <>
      {valores.map((valor, i) => (
        <td key={i} className={`${celulaCompacta} whitespace-nowrap`}>
          {valor}
        </td>
      ))}
    </>
  );
}

export function TabelaPanorama({ linhas, total }: { linhas: LinhaPanorama[]; total: LinhaPanorama }) {
  return (
    <section aria-labelledby="titulo-panorama" className={classeCartao}>
      <h2 id="titulo-panorama" className="mb-1 text-lg font-semibold">
        Panorama por comitê
      </h2>
      <p className="mb-3 text-sm text-texto-secundario">
        Projeto ligado a mais de um comitê aparece em cada um. O total geral é apurado de novo e conta cada registro uma única vez; por isso, pode ser menor que a soma das linhas.
      </p>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-left" data-teste="panorama">
          <thead>
            <tr>
              {COLUNAS_PANORAMA.map((coluna) => (
                <th key={coluna} scope="col" className={cabecalhoCompacto}>
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.comiteId}>
                <th scope="row" className={`${celulaCompacta} font-medium`}>
                  {linha.comite}
                </th>
                <td className={celulaCompacta}>
                  {linha.projetosPrincipais}
                  {linha.projetosParticipantes > 0 && ` + ${linha.projetosParticipantes} participante(s)`}
                </td>
                <CelulasPanorama linha={linha} />
              </tr>
            ))}
            <tr className="font-semibold">
              <th scope="row" className={celulaCompacta}>
                {total.comite}
              </th>
              <td className={celulaCompacta}>{total.projetosPrincipais}</td>
              <CelulasPanorama linha={total} />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-texto-secundario">
        Interações: data de início. Vencidos e atrasados: prazo registrado, com referência em hoje. B, M, A e C: baixo, moderado, alto e crítico, na classificação vigente. * Regra provisória P-049.
      </p>
    </section>
  );
}

export function TabelaProjetos({ linhas, projetos }: { linhas: LinhaPanorama[]; projetos: { id: string; nome: string; comiteNome: string }[] }) {
  if (projetos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-borda p-8 text-center text-texto-secundario">
        Nenhum projeto ou tema disponível para o seu perfil com estes filtros.
      </p>
    );
  }
  const porId = new Map(linhas.map((l) => [l.comiteId, l]));
  return (
    <section aria-labelledby="titulo-por-projeto" className={classeCartao}>
      <h2 id="titulo-por-projeto" className="mb-3 text-lg font-semibold">
        Acompanhamento por projeto ou tema
      </h2>
      <div className="overflow-x-auto print:overflow-visible">
        <table className={classeTabela} data-teste="projetos">
          <thead>
            <tr>
              {["Projeto ou tema", "Comitê principal", "Iniciativas em curso", "Compromissos pendentes", "Compromissos vencidos", "Ações atrasadas", "Marcos", "Riscos a reavaliar*", "Sem avaliação"].map((c) => (
                <th key={c} scope="col" className={classeCelulaCabecalho}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projetos.map((p) => {
              const l = porId.get(p.id);
              return (
                <tr key={p.id}>
                  <th scope="row" className={`${classeCelula} font-normal`}>
                    <Link href={`/paineis/projetos/${p.id}`} className={classeLink}>
                      {p.nome}
                    </Link>
                  </th>
                  <td className={classeCelula}>{p.comiteNome}</td>
                  <td className={`${classeCelula} tabular-nums`}>{l?.iniciativasEmCurso}</td>
                  <td className={`${classeCelula} tabular-nums`}>{l?.compromissosPendentes}</td>
                  <td className={`${classeCelula} tabular-nums`}>{l?.compromissosVencidos}</td>
                  <td className={`${classeCelula} tabular-nums`}>{l?.acoesAtrasadas}</td>
                  <td className={`${classeCelula} tabular-nums`}>
                    {l?.marcosAlcancados} de {l?.marcosPrevistos}
                  </td>
                  <td className={`${classeCelula} tabular-nums`}>{l?.riscosAReavaliar}</td>
                  <td className={`${classeCelula} tabular-nums`}>{l?.stakeholdersSemAvaliacao}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-texto-secundario">* Regra provisória P-049. Sem avaliação: stakeholders associados sem avaliação publicada.</p>
    </section>
  );
}

/** Filtros no endereço da página: funcionam sem JavaScript. */
export function FiltrosDoPainel({
  filtros,
  comites,
  projetos,
  usuarios,
  caminho,
  periodoInvertido,
}: {
  filtros: FiltrosPainel;
  /** Sem comitês e projetos, na página de um projeto ou tema. */
  comites?: { id: string; nome: string }[];
  projetos?: { id: string; nome: string }[];
  usuarios: { id: string; nome: string }[];
  caminho: string;
  periodoInvertido: boolean;
}) {
  const selecao = (id: string, nome: string, rotulo: string, valor: string | undefined, opcoes: { id: string; nome: string }[], vazio: string) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <select id={id} name={nome} defaultValue={valor ?? ""} className={classeEntrada}>
        <option value="">{vazio}</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </div>
  );
  // D-091: a chave muda com os filtros do endereço e recria o formulário. Sem ela, ao navegar sem
  // recarregar a página (botão "Limpar", voltar do navegador), os campos mantinham a escolha anterior,
  // porque o valor inicial (defaultValue) só é lido quando o campo é criado.
  return (
    <form key={parametrosDosFiltros(filtros)} role="search" className={`${classeCartao} grid gap-3 print:hidden sm:grid-cols-2 lg:grid-cols-5`}>
      {comites && selecao("filtro-comite", "comite", "Comitê", filtros.comiteId, comites, "Todos")}
      {projetos && selecao("filtro-projeto", "projeto", "Projeto ou tema", filtros.projetoTemaId, projetos, "Todos")}
      {selecao("filtro-responsavel", "responsavel", "Responsável (equipe)", filtros.responsavelId, usuarios, "Todos")}
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-de" className="text-sm font-medium">
          Período: de
        </label>
        <input id="filtro-de" name="de" type="date" defaultValue={filtros.de ?? ""} className={classeEntrada} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-ate" className="text-sm font-medium">
          Período: até
        </label>
        <input id="filtro-ate" name="ate" type="date" defaultValue={filtros.ate ?? ""} className={classeEntrada} />
      </div>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-5">
        <button type="submit" className={classeBotaoPrimario}>
          Aplicar filtros
        </button>
        <Link href={caminho} className={classeBotaoSecundario}>
          Limpar
        </Link>
        {periodoInvertido && <span className="text-sm text-red-700 dark:text-red-400">O início do período é posterior ao fim: o período foi ignorado.</span>}
        <span className="text-xs text-texto-secundario">O período só afeta os indicadores de movimento; cada indicador informa a data usada. Situação atual não muda com o período.</span>
      </div>
    </form>
  );
}
