import { classeBotaoSecundario } from "@/componentes/estilos";

type PropriedadesBotaoArquivamento = {
  /** Ação do servidor já associada ao registro e à operação (arquivar ou reativar). */
  acao: () => Promise<void>;
  arquivado: boolean;
};

/** Arquiva ou reativa um registro. O arquivamento é reversível e fica no histórico. */
export function BotaoArquivamento({ acao, arquivado }: PropriedadesBotaoArquivamento) {
  return (
    <form action={acao}>
      <button type="submit" className={classeBotaoSecundario}>
        {arquivado ? "Reativar" : "Arquivar"}
      </button>
    </form>
  );
}
