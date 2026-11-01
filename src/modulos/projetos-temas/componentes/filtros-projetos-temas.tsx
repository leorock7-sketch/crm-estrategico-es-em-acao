import { classeBotaoSecundario, classeEntrada } from "@/componentes/estilos";
import {
  ROTULOS_SITUACAO_PROJETO_TEMA,
  ROTULOS_TIPO_PROJETO_TEMA,
  SITUACOES_PROJETO_TEMA,
  TIPOS_PROJETO_TEMA,
} from "../rotulos";
import type { OpcaoComite } from "./formulario-projeto-tema";

export type ValoresFiltro = {
  busca: string;
  tipo: string;
  situacao: string;
  comite: string;
  incluirArquivados: boolean;
};

/** Filtros da lista (funcionam sem JavaScript: os valores vão no endereço da página). */
export function FiltrosProjetosTemas({
  valores,
  comites,
}: {
  valores: ValoresFiltro;
  comites: OpcaoComite[];
}) {
  return (
    <form role="search" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.5fr]">
      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
        <label htmlFor="busca" className="text-sm font-medium">
          Buscar por nome
        </label>
        <input id="busca" name="busca" type="search" defaultValue={valores.busca} className={classeEntrada} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-tipo" className="text-sm font-medium">
          Tipo
        </label>
        <select id="filtro-tipo" name="tipo" defaultValue={valores.tipo} className={classeEntrada}>
          <option value="">Todos</option>
          {TIPOS_PROJETO_TEMA.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ROTULOS_TIPO_PROJETO_TEMA[tipo]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-situacao" className="text-sm font-medium">
          Situação
        </label>
        <select id="filtro-situacao" name="situacao" defaultValue={valores.situacao} className={classeEntrada}>
          <option value="">Todas</option>
          {SITUACOES_PROJETO_TEMA.map((situacao) => (
            <option key={situacao} value={situacao}>
              {ROTULOS_SITUACAO_PROJETO_TEMA[situacao]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-comite" className="text-sm font-medium">
          Comitê (principal ou participante)
        </label>
        <select id="filtro-comite" name="comite" defaultValue={valores.comite} className={classeEntrada}>
          <option value="">Todos</option>
          {comites.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="arquivados"
            value="sim"
            defaultChecked={valores.incluirArquivados}
            className="size-4"
          />
          Incluir arquivados
        </label>
        <button type="submit" className={classeBotaoSecundario}>
          Filtrar
        </button>
      </div>
    </form>
  );
}
