"use client";

import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo } from "@/componentes/campo";
import { classeBotaoPrimario, classeEntrada } from "@/componentes/estilos";
import { type EstadoAutenticacao, trocarSenha } from "./acoes";

const ESTADO_INICIAL: EstadoAutenticacao = {};

export function FormularioTrocaSenha() {
  const [estado, acao, enviando] = useActionState(trocarSenha, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  return (
    <form action={acao} className="flex flex-col gap-4">
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.sucesso && <Alerta tom="sucesso">Senha alterada.</Alerta>}
      <Campo id="senhaAtual" rotulo="Senha atual" obrigatorio erros={erros.senhaAtual}>
        <input id="senhaAtual" name="senhaAtual" type="password" required autoComplete="current-password" className={classeEntrada} />
      </Campo>
      <Campo id="novaSenha" rotulo="Nova senha" obrigatorio ajuda="Pelo menos 12 caracteres." erros={erros.novaSenha}>
        <input id="novaSenha" name="novaSenha" type="password" required minLength={12} autoComplete="new-password" className={classeEntrada} />
      </Campo>
      <Campo id="confirmacao" rotulo="Confirme a nova senha" obrigatorio erros={erros.confirmacao}>
        <input id="confirmacao" name="confirmacao" type="password" required minLength={12} autoComplete="new-password" className={classeEntrada} />
      </Campo>
      <div>
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Trocando…" : "Trocar a senha"}
        </button>
      </div>
    </form>
  );
}
