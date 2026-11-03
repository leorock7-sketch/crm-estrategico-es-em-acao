import { classeBotaoSecundario, classeEntrada } from "@/componentes/estilos";
import type { OpcaoProjetoTema, OpcaoUsuario } from "@/modulos/iniciativas/componentes/formulario-iniciativa";
import { Filtro } from "@/modulos/iniciativas/componentes/filtros-iniciativas";
import {
  FILTROS_COMPROMISSO,
  PERIODOS_INTERACAO,
  ROTULOS_FILTRO_COMPROMISSO,
  ROTULOS_PERIODO_INTERACAO,
  ROTULOS_SITUACAO_INTERACAO,
  ROTULOS_TIPO_INTERACAO,
  SITUACOES_INTERACAO,
  TIPOS_INTERACAO,
} from "../rotulos";

type OpcaoNome = { id: string; nome: string };

export type ValoresFiltroInteracoes = {
  busca: string;
  tipo: string;
  situacao: string;
  periodo: string;
  projeto: string;
  iniciativa: string;
  stakeholder: string;
  incluirArquivadas: boolean;
};

/** Filtros das interações (funcionam sem JavaScript: os valores vão no endereço da página). */
export function FiltrosInteracoes({
  valores,
  projetos,
  iniciativas,
  pessoas,
  instituicoes,
}: {
  valores: ValoresFiltroInteracoes;
  projetos: OpcaoProjetoTema[];
  iniciativas: { id: string; titulo: string }[];
  pessoas: OpcaoNome[];
  instituicoes: OpcaoNome[];
}) {
  return (
    <form role="search" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor="busca" className="text-sm font-medium">
          Buscar pelo assunto
        </label>
        <input id="busca" name="busca" type="search" defaultValue={valores.busca} className={classeEntrada} />
      </div>
      <Filtro id="filtro-periodo" nome="periodo" rotulo="Período" valor={valores.periodo} todos="Todos">
        {PERIODOS_INTERACAO.map((p) => (
          <option key={p} value={p}>
            {ROTULOS_PERIODO_INTERACAO[p]}
          </option>
        ))}
      </Filtro>
      <Filtro id="filtro-tipo" nome="tipo" rotulo="Tipo" valor={valores.tipo} todos="Todos">
        {TIPOS_INTERACAO.map((t) => (
          <option key={t} value={t}>
            {ROTULOS_TIPO_INTERACAO[t]}
          </option>
        ))}
      </Filtro>
      <Filtro id="filtro-situacao" nome="situacao" rotulo="Situação" valor={valores.situacao} todos="Todas">
        {SITUACOES_INTERACAO.map((s) => (
          <option key={s} value={s}>
            {ROTULOS_SITUACAO_INTERACAO[s]}
          </option>
        ))}
      </Filtro>
      <Filtro id="filtro-projeto" nome="projeto" rotulo="Projeto ou tema" valor={valores.projeto} todos="Todos">
        {projetos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </Filtro>
      <Filtro id="filtro-iniciativa" nome="iniciativa" rotulo="Iniciativa" valor={valores.iniciativa} todos="Todas">
        {iniciativas.map((i) => (
          <option key={i.id} value={i.id}>
            {i.titulo}
          </option>
        ))}
      </Filtro>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-stakeholder" className="text-sm font-medium">
          Participante externo
        </label>
        <select id="filtro-stakeholder" name="stakeholder" defaultValue={valores.stakeholder} className={classeEntrada}>
          <option value="">Todos</option>
          <optgroup label="Instituições">
            {instituicoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </optgroup>
          <optgroup label="Pessoas">
            {pessoas.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="arquivadas" value="sim" defaultChecked={valores.incluirArquivadas} className="size-4" />
          Incluir arquivadas
        </label>
        <button type="submit" className={classeBotaoSecundario}>
          Filtrar
        </button>
      </div>
    </form>
  );
}

export type ValoresFiltroCompromissos = {
  prazo: string;
  responsavel: string;
  projeto: string;
  iniciativa: string;
  busca: string;
};

/** Filtros dos compromissos: situação ou prazo, responsável, projeto e iniciativa. */
export function FiltrosCompromissos({
  valores,
  usuarios,
  pessoas,
  instituicoes,
  projetos,
  iniciativas,
}: {
  valores: ValoresFiltroCompromissos;
  usuarios: OpcaoUsuario[];
  pessoas: OpcaoNome[];
  instituicoes: OpcaoNome[];
  projetos: OpcaoProjetoTema[];
  iniciativas: { id: string; titulo: string }[];
}) {
  return (
    <form role="search" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-prazo" className="text-sm font-medium">
          Situação
        </label>
        <select id="filtro-prazo" name="prazo" defaultValue={valores.prazo || "pendentes"} className={classeEntrada}>
          {FILTROS_COMPROMISSO.map((f) => (
            <option key={f} value={f}>
              {ROTULOS_FILTRO_COMPROMISSO[f]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-responsavel" className="text-sm font-medium">
          Responsável
        </label>
        <select id="filtro-responsavel" name="responsavel" defaultValue={valores.responsavel} className={classeEntrada}>
          <option value="">Todos</option>
          <optgroup label="Equipe interna">
            {usuarios.map((u) => (
              <option key={u.id} value={`u:${u.id}`}>
                {u.nome}
              </option>
            ))}
          </optgroup>
          <optgroup label="Instituições">
            {instituicoes.map((o) => (
              <option key={o.id} value={`s:${o.id}`}>
                {o.nome}
              </option>
            ))}
          </optgroup>
          <optgroup label="Pessoas">
            {pessoas.map((o) => (
              <option key={o.id} value={`s:${o.id}`}>
                {o.nome}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <Filtro id="filtro-projeto" nome="projeto" rotulo="Projeto ou tema" valor={valores.projeto} todos="Todos">
        {projetos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </Filtro>
      <Filtro id="filtro-iniciativa" nome="iniciativa" rotulo="Iniciativa" valor={valores.iniciativa} todos="Todas">
        {iniciativas.map((i) => (
          <option key={i.id} value={i.id}>
            {i.titulo}
          </option>
        ))}
      </Filtro>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor="busca" className="text-sm font-medium">
          Buscar na descrição
        </label>
        <input id="busca" name="busca" type="search" defaultValue={valores.busca} className={classeEntrada} />
      </div>
      <div className="flex items-end">
        <button type="submit" className={classeBotaoSecundario}>
          Filtrar
        </button>
      </div>
    </form>
  );
}
