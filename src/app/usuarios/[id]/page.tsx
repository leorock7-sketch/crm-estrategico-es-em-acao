import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BotaoAcaoRegistro } from "@/componentes/botao-acao-registro";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoSecundario, classeCartao, classeLink } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarData, formatarDataHora } from "@/lib/formatacao";
import { esquemaIdentificador } from "@/lib/validacao/comuns";
import { desativarUsuarioAcao, reativarUsuarioAcao, revogarPermissaoAcao } from "@/modulos/acesso/acoes-usuarios";
import { ehAdministrador } from "@/modulos/acesso/capacidades";
import { FormularioEdicaoUsuario, FormularioPermissao, FormularioRedefinirSenha } from "@/modulos/acesso/componentes/formularios-usuarios";
import { ROTULOS_PERFIL } from "@/modulos/acesso/esquemas-usuarios";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { obterUsuario, permissoesDoUsuario } from "@/modulos/acesso/usuarios";
import { opcoesProjetosTemas } from "@/modulos/iniciativas/consultas";

export const metadata: Metadata = { title: "Usuário" };

export default function PaginaUsuario({ params }: PageProps<"/usuarios/[id]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <DetalheUsuario params={params} />
    </Suspense>
  );
}

async function DetalheUsuario({ params }: Pick<PageProps<"/usuarios/[id]">, "params">) {
  const { id } = await params;
  if (!esquemaIdentificador.safeParse(id).success) notFound();
  const banco = await bancoDaRequisicao();
  if (!(await ehAdministrador(banco))) notFound();
  const alvo = await obterUsuario(banco, id);
  if (!alvo) notFound();

  const [permissoes, projetos, atual] = await Promise.all([
    permissoesDoUsuario(banco, id),
    opcoesProjetosTemas(banco, "todos"),
    obterUsuarioAtual(banco),
  ]);
  const comPermissaoVigente = new Set(permissoes.filter((p) => !p.revogadaEm).map((p) => p.projetoTemaId));
  const disponiveis = projetos.filter((p) => !comPermissaoVigente.has(p.id));
  const ativo = alvo.situacao === "ativo";
  const proprio = atual.id === id;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={alvo.nome}
        voltar={{ href: "/usuarios", rotulo: "Usuários e permissões" }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <span>{alvo.email}</span>
            {ativo ? <SeloSituacao tom="sucesso">Ativo</SeloSituacao> : <SeloSituacao tom="neutro">Inativo</SeloSituacao>}
            {alvo.administrador && <SeloSituacao tom="aviso">Administrador</SeloSituacao>}
            {!alvo.authId && <SeloSituacao tom="aviso">Sem conta de acesso</SeloSituacao>}
          </span>
        }
        acoes={
          !proprio &&
          (ativo ? (
            <BotaoAcaoRegistro
              acao={desativarUsuarioAcao}
              campos={{ usuarioId: id }}
              rotulo="Desativar usuário"
              rotuloEnviando="Desativando…"
              classeBotao={classeBotaoSecundario}
            />
          ) : (
            <BotaoAcaoRegistro
              acao={reativarUsuarioAcao}
              campos={{ usuarioId: id }}
              rotulo="Reativar usuário"
              rotuloEnviando="Reativando…"
              classeBotao={classeBotaoSecundario}
            />
          ))
        }
      />

      {!ativo && (
        <p className="rounded-lg border border-borda bg-superficie p-3 text-sm">
          Usuário inativo: não consulta nem grava nada, mesmo com sessão aberta. Os registros de sua autoria são preservados.
        </p>
      )}

      <section aria-labelledby="titulo-permissoes" className={classeCartao}>
        <h2 id="titulo-permissoes" className="mb-1 text-lg font-semibold">
          Permissões por projeto ou tema
        </h2>
        <p className="mb-4 text-sm text-texto-secundario">
          {alvo.administrador
            ? "Como administrador, tem acesso integral; as permissões abaixo só valerão se deixar de ser administrador."
            : "Revogar vale de imediato, mesmo com sessão aberta, e a permissão continua no histórico."}
        </p>
        {permissoes.length === 0 ? (
          <p className="mb-4 text-sm text-texto-secundario">
            Nenhuma permissão. Este usuário só consulta o diretório básico de pessoas e instituições.
          </p>
        ) : (
          <ul className="mb-4 flex flex-col divide-y divide-borda text-sm">
            {permissoes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/projetos-temas/${p.projetoTemaId}`} className={classeLink}>
                    {p.projetoNome}
                  </Link>
                  <span>· {ROTULOS_PERFIL[p.perfil]}</span>
                  {p.revogadaEm ? (
                    <SeloSituacao tom="neutro">Revogada em {formatarDataHora(p.revogadaEm)}</SeloSituacao>
                  ) : p.vencida ? (
                    <SeloSituacao tom="aviso">Vencida em {formatarData(p.validaAte)}</SeloSituacao>
                  ) : p.validaAte ? (
                    <SeloSituacao tom="sucesso">Válida até {formatarData(p.validaAte)}</SeloSituacao>
                  ) : (
                    <SeloSituacao tom="sucesso">Válida</SeloSituacao>
                  )}
                </span>
                {!p.revogadaEm && (
                  <BotaoAcaoRegistro
                    acao={revogarPermissaoAcao}
                    campos={{ usuarioId: id, permissaoId: p.id }}
                    rotulo="Revogar"
                    rotuloEnviando="Revogando…"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        <details className="rounded-lg border border-borda p-4">
          <summary className="cursor-pointer font-medium">Conceder permissão</summary>
          <div className="mt-4">
            <FormularioPermissao usuarioId={id} projetos={disponiveis} />
          </div>
        </details>
      </section>

      <section aria-labelledby="titulo-cadastro" className={classeCartao}>
        <h2 id="titulo-cadastro" className="mb-4 text-lg font-semibold">
          Cadastro
        </h2>
        <FormularioEdicaoUsuario usuarioId={id} nome={alvo.nome} administrador={alvo.administrador} proprio={proprio} />
      </section>

      {alvo.authId && (
        <section aria-labelledby="titulo-senha" className={classeCartao}>
          <h2 id="titulo-senha" className="mb-1 text-lg font-semibold">
            Senha
          </h2>
          <p className="mb-4 text-sm text-texto-secundario">
            Sem o serviço de e-mail institucional (Etapa 7), a recuperação de senha é feita aqui pelo administrador.
          </p>
          <FormularioRedefinirSenha usuarioId={id} />
        </section>
      )}
    </div>
  );
}
