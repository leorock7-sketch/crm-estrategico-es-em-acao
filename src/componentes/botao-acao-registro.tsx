"use client";

import { useActionState } from "react";

/** Estado devolvido pelas ações (mesmo formato dos demais formulários). */
type EstadoAcao = {
  erros?: Record<string, string[] | undefined>;
  mensagem?: string;
  valores?: Record<string, string>;
  sucesso?: boolean;
};

type AcaoRegistro = (estado: EstadoAcao, formData: FormData) => Promise<EstadoAcao>;

const ESTADO_INICIAL: EstadoAcao = {};

/**
 * Botão que executa uma ação sobre um registro (por exemplo, retirar uma
 * ligação), enviando os campos ocultos informados e mostrando o erro, se houver.
 */
export function BotaoAcaoRegistro({
  acao: acaoServidor,
  campos,
  rotulo,
  rotuloEnviando,
  classeBotao,
}: {
  acao: AcaoRegistro;
  campos: Record<string, string>;
  rotulo: string;
  rotuloEnviando: string;
  /** Aparência do botão; por padrão, discreta (texto sublinhado ao passar o mouse). */
  classeBotao?: string;
}) {
  const [estado, acao, enviando] = useActionState(acaoServidor, ESTADO_INICIAL);
  return (
    <form action={acao} className="inline-flex flex-col items-start gap-1">
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <button
        type="submit"
        disabled={enviando}
        className={classeBotao ?? "text-xs text-texto-secundario underline-offset-2 hover:underline disabled:opacity-60"}
      >
        {enviando ? rotuloEnviando : rotulo}
      </button>
      {estado.mensagem && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {estado.mensagem}
        </p>
      )}
    </form>
  );
}
