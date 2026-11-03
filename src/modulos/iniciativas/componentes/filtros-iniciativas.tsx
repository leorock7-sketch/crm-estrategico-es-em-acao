import type { ReactNode } from "react";
import { classeBotaoSecundario, classeEntrada } from "@/componentes/estilos";
import {
  PRIORIDADES_INICIATIVA,
  ROTULOS_PRIORIDADE_INICIATIVA,
  ROTULOS_SITUACAO_INICIATIVA,
  ROTULOS_TIPO_INICIATIVA,
  SITUACOES_INICIATIVA,
  TIPOS_INICIATIVA,
} from "../rotulos";
import type { OpcaoProjetoTema, OpcaoUsuario } from "./formulario-iniciativa";

export type ValoresFiltroIniciativas = {
  busca: string;
  tipo: string;
  situacao: string;
  prioridade: string;
  comite: string;
  projeto: string;
  responsavel: string;
  incluirArquivadas: boolean;
};

/** Filtros da Matriz de Iniciativas (funcionam sem JavaScript: os valores vão no endereço da página). */
export function FiltrosIniciativas({
  valores,
  comites,
  projetos,
  usuarios,
}: {
  valores: ValoresFiltroIniciativas;
  comites: { id: string; nome: string }[];
  projetos: OpcaoProjetoTema[];
  usuarios: OpcaoUsuario[];
}) {
  return (
    <form role="search" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor="busca" className="text-sm font-medium">
          Buscar pelo título
        </label>
        <input id="busca" name="busca" type="search" defaultValue={valores.busca} className={classeEntrada} />
      </div>
      <Filtro id="filtro-tipo" nome="tipo" rotulo="Tipo" valor={valores.tipo} todos="Todos">
        {TIPOS_INICIATIVA.map((t) => (
          <option key={t} value={t}>
            {ROTULOS_TIPO_INICIATIVA[t]}
          </option>
        ))}
      </Filtro>
      <Filtro id="filtro-situacao" nome="situacao" rotulo="Situação" valor={valores.situacao} todos="Todas">
        <option value="em_curso">Em curso (não encerradas)</option>
        {SITUACOES_INICIATIVA.map((s) => (
          <option key={s} value={s}>
            {ROTULOS_SITUACAO_INICIATIVA[s]}
          </option>
        ))}
      </Filtro>
      <Filtro id="filtro-comite" nome="comite" rotulo="Comitê" valor={valores.comite} todos="Todos">
        {comites.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
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
      <Filtro id="filtro-responsavel" nome="responsavel" rotulo="Responsável" valor={valores.responsavel} todos="Todos">
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nome}
          </option>
        ))}
      </Filtro>
      <Filtro id="filtro-prioridade" nome="prioridade" rotulo="Prioridade" valor={valores.prioridade} todos="Todas">
        {PRIORIDADES_INICIATIVA.map((p) => (
          <option key={p} value={p}>
            {ROTULOS_PRIORIDADE_INICIATIVA[p]}
          </option>
        ))}
      </Filtro>
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

/** Lista de seleção de um filtro, com a opção "todos" no início. */
export function Filtro({
  id,
  nome,
  rotulo,
  valor,
  todos,
  children,
}: {
  id: string;
  nome: string;
  rotulo: string;
  valor: string;
  todos: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <select id={id} name={nome} defaultValue={valor} className={classeEntrada}>
        <option value="">{todos}</option>
        {children}
      </select>
    </div>
  );
}
