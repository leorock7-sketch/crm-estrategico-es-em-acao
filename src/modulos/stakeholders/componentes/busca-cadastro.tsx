import { classeBotaoSecundario, classeEntrada } from "@/componentes/estilos";

type PropriedadesBusca = {
  rotulo: string;
  busca: string;
  incluirArquivados: boolean;
  rotuloArquivados: string;
};

/** Busca por texto (funciona sem JavaScript: os filtros vão no endereço da página). */
export function BuscaCadastro({ rotulo, busca, incluirArquivados, rotuloArquivados }: PropriedadesBusca) {
  return (
    <form role="search" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="busca" className="text-sm font-medium">
          {rotulo}
        </label>
        <input
          id="busca"
          name="busca"
          type="search"
          defaultValue={busca}
          className={classeEntrada}
        />
      </div>
      <label className="flex items-center gap-2 text-sm sm:pb-2">
        <input
          type="checkbox"
          name="arquivados"
          value="sim"
          defaultChecked={incluirArquivados}
          className="size-4"
        />
        {rotuloArquivados}
      </label>
      <button type="submit" className={classeBotaoSecundario}>
        Buscar
      </button>
    </form>
  );
}
