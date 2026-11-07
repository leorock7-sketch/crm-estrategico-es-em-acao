"use client";

import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo } from "@/componentes/campo";
import { classeBotaoPrimario, classeEntrada } from "@/componentes/estilos";
import { entrar, type EstadoAutenticacao } from "./acoes";

const ESTADO_INICIAL: EstadoAutenticacao = {};

export function FormularioLogin({ destino }: { destino: string }) {
  const [estado, acao, enviando] = useActionState(entrar, ESTADO_INICIAL);
  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="destino" value={destino} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      <Campo id="email" rotulo="E-mail" obrigatorio>
        <input id="email" name="email" type="email" required autoComplete="username" className={classeEntrada} />
      </Campo>
      <Campo id="senha" rotulo="Senha" obrigatorio>
        <input id="senha" name="senha" type="password" required autoComplete="current-password" className={classeEntrada} />
      </Campo>
      <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
