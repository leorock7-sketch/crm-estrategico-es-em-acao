"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alerta } from "@/componentes/alerta";
import { Campo } from "@/componentes/campo";
import { classeBotaoPrimario, classeBotaoSecundario, classeEntrada, classeLink } from "@/componentes/estilos";
import { BotaoEnviar, CampoSelecao, MensagensFormulario, useFormularioRegistro } from "@/componentes/formulario-registro";
import {
  concederPermissaoAcao,
  criarUsuarioAcao,
  editarUsuarioAcao,
  type EstadoNovoUsuario,
  redefinirSenhaAcao,
} from "../acoes-usuarios";
import { DESCRICOES_PERFIL, PERFIS_CONTEXTO, ROTULOS_PERFIL } from "../esquemas-usuarios";

const ESTADO_INICIAL: EstadoNovoUsuario = {};

/** A senha provisória não é guardada: aparece uma única vez, para o administrador repassar. */
function SenhaProvisoria({ senha }: { senha: string }) {
  return (
    <Alerta tom="aviso" titulo="Senha provisória (aparece só agora)">
      <p className="mb-2">
        Copie e repasse por um canal seguro. Ela não é guardada: se for perdida, redefina. A pessoa deve trocá-la em “Minha
        conta” no primeiro acesso.
      </p>
      <code data-teste="senha-provisoria" className="block break-all rounded bg-superficie p-2 font-mono text-sm">
        {senha}
      </code>
    </Alerta>
  );
}

export function FormularioNovoUsuario({ modoLocal }: { modoLocal: boolean }) {
  const [estado, acao, enviando] = useActionState(criarUsuarioAcao, ESTADO_INICIAL);
  const erros = estado.erros ?? {};
  if (estado.sucesso) {
    return (
      <div className="flex flex-col gap-4">
        <Alerta tom="sucesso">Usuário cadastrado. Conceda agora as permissões por projeto ou tema.</Alerta>
        {estado.senhaProvisoria && <SenhaProvisoria senha={estado.senhaProvisoria} />}
        {estado.novoUsuarioId && (
          <Link href={`/usuarios/${estado.novoUsuarioId}`} className={classeBotaoPrimario}>
            Abrir o cadastro para conceder permissões
          </Link>
        )}
      </div>
    );
  }
  return (
    <form key={JSON.stringify(estado.valores ?? {})} action={acao} className="flex flex-col gap-4">
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {modoLocal && (
        <Alerta tom="aviso">
          Modo local: o cadastro é criado sem conta de acesso, porque aqui não há login. Nada disto vale como teste de autenticação.
        </Alerta>
      )}
      <Campo id="nome" rotulo="Nome" obrigatorio erros={erros.nome}>
        <input id="nome" name="nome" required maxLength={200} defaultValue={estado.valores?.nome ?? ""} className={classeEntrada} />
      </Campo>
      <Campo id="email" rotulo="E-mail" obrigatorio ajuda="O e-mail serve para entrar, mas não concede acesso por si." erros={erros.email}>
        <input id="email" name="email" type="email" required autoComplete="off" defaultValue={estado.valores?.email ?? ""} className={classeEntrada} />
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="administrador" defaultChecked={estado.valores?.administrador === "on"} />
        Administrador do sistema (controle integral, inclusive de usuários e permissões)
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className={classeBotaoPrimario}>
          {enviando ? "Cadastrando…" : "Cadastrar"}
        </button>
        <Link href="/usuarios" className={classeBotaoSecundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export function FormularioEdicaoUsuario({
  usuarioId,
  nome,
  administrador,
  proprio,
}: {
  usuarioId: string;
  nome: string;
  administrador: boolean;
  proprio: boolean;
}) {
  const f = useFormularioRegistro(editarUsuarioAcao, { nome }, "edicao");
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-4">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <MensagensFormulario estado={f.estado} sucesso="Cadastro atualizado." />
      <Campo id={f.id("nome")} rotulo="Nome" obrigatorio erros={f.erros.nome}>
        <input id={f.id("nome")} name="nome" required maxLength={200} defaultValue={f.valor("nome")} className={classeEntrada} />
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="administrador" defaultChecked={administrador} />
        Administrador do sistema
      </label>
      {proprio && administrador && (
        <p className="text-xs text-texto-secundario">O sistema não aceita ficar sem nenhum administrador ativo.</p>
      )}
      <BotaoEnviar enviando={f.enviando} rotulo="Salvar" />
    </form>
  );
}

export function FormularioRedefinirSenha({ usuarioId }: { usuarioId: string }) {
  const [estado, acao, enviando] = useActionState(redefinirSenhaAcao, ESTADO_INICIAL);
  return (
    <form action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      {estado.mensagem && <Alerta tom="erro">{estado.mensagem}</Alerta>}
      {estado.senhaProvisoria && <SenhaProvisoria senha={estado.senhaProvisoria} />}
      <div>
        <button type="submit" disabled={enviando} className={classeBotaoSecundario}>
          {enviando ? "Redefinindo…" : "Gerar nova senha provisória"}
        </button>
      </div>
    </form>
  );
}

export function FormularioPermissao({
  usuarioId,
  projetos,
}: {
  usuarioId: string;
  projetos: { id: string; nome: string }[];
}) {
  const f = useFormularioRegistro(concederPermissaoAcao, { projetoTemaId: "", perfil: "", validaAte: "" }, "permissao");
  if (projetos.length === 0) {
    return (
      <p className="text-sm text-texto-secundario">
        Este usuário já tem permissão em todos os projetos e temas.{" "}
        <Link href="/projetos-temas" className={classeLink}>
          Ver projetos e temas
        </Link>
      </p>
    );
  }
  return (
    <form key={f.chave} action={f.acao} className="flex flex-col gap-4">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <MensagensFormulario estado={f.estado} sucesso="Permissão concedida." />
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoSelecao
          id={f.id("projetoTemaId")}
          nome="projetoTemaId"
          rotulo="Projeto ou tema"
          valor={f.valor("projetoTemaId")}
          vazio="Selecione…"
          obrigatorio
          erros={f.erros.projetoTemaId}
        >
          {projetos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </CampoSelecao>
        <CampoSelecao
          id={f.id("perfil")}
          nome="perfil"
          rotulo="Perfil"
          valor={f.valor("perfil")}
          vazio="Selecione…"
          obrigatorio
          erros={f.erros.perfil}
        >
          {PERFIS_CONTEXTO.map((perfil) => (
            <option key={perfil} value={perfil}>
              {ROTULOS_PERFIL[perfil]}
            </option>
          ))}
        </CampoSelecao>
        <Campo id={f.id("validaAte")} rotulo="Válida até" ajuda="Em branco: sem vencimento." erros={f.erros.validaAte}>
          <input id={f.id("validaAte")} name="validaAte" type="date" defaultValue={f.valor("validaAte")} className={classeEntrada} />
        </Campo>
      </div>
      <ul className="text-xs text-texto-secundario">
        {PERFIS_CONTEXTO.map((perfil) => (
          <li key={perfil}>
            <strong>{ROTULOS_PERFIL[perfil]}:</strong> {DESCRICOES_PERFIL[perfil]}
          </li>
        ))}
      </ul>
      <BotaoEnviar enviando={f.enviando} rotulo="Conceder permissão" rotuloEnviando="Concedendo…" />
    </form>
  );
}
