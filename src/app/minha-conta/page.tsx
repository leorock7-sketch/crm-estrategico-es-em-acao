import type { Metadata } from "next";
import { Suspense } from "react";
import { Alerta } from "@/componentes/alerta";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeCartao, classeLink } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { FormularioTrocaSenha } from "@/lib/autenticacao/formulario-troca-senha";
import { modoDeAcesso } from "@/lib/banco/ambiente";
import { permissaoContexto, projetoTema } from "@/lib/banco/esquema";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { formatarData } from "@/lib/formatacao";
import { ROTULOS_PERFIL } from "@/modulos/acesso/esquemas-usuarios";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import Link from "next/link";

export const metadata: Metadata = { title: "Minha conta" };

async function trocaDeSenhaPendente(): Promise<boolean> {
  const { consultarSessao } = await import("@/lib/autenticacao/sessao");
  const sessao = await consultarSessao();
  return sessao.tipo === "ativa" && sessao.trocaDeSenhaPendente;
}

export default function PaginaMinhaConta() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <CabecalhoPagina titulo="Minha conta" />
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  const banco = await bancoDaRequisicao();
  const usuario = await obterUsuarioAtual(banco);
  const trocaPendente = modoDeAcesso() === "supabase" && (await trocaDeSenhaPendente());
  const permissoes = await banco
    .select({
      id: permissaoContexto.id,
      projetoTemaId: permissaoContexto.projetoTemaId,
      projetoNome: projetoTema.nome,
      perfil: permissaoContexto.perfil,
      validaAte: permissaoContexto.validaAte,
    })
    .from(permissaoContexto)
    .innerJoin(projetoTema, eq(projetoTema.id, permissaoContexto.projetoTemaId))
    .where(
      and(
        eq(permissaoContexto.usuarioId, usuario.id),
        isNull(permissaoContexto.arquivadoEm),
        sql`(${permissaoContexto.validaAte} is null or ${permissaoContexto.validaAte} >= hoje_em_brasilia())`,
      ),
    )
    .orderBy(asc(projetoTema.nome));
  return (
    <>
      {trocaPendente && (
        <Alerta tom="aviso" titulo="Defina sua senha pessoal para continuar">
          Sua conta está com uma senha provisória, criada ou redefinida pelo administrador. As demais telas ficam disponíveis assim que você trocá-la abaixo.
        </Alerta>
      )}
      <section className={classeCartao}>
        <p className="font-medium">{usuario.nome}</p>
        <p className="text-sm text-texto-secundario">{usuario.email}</p>
      </section>
      <section aria-labelledby="titulo-minhas-permissoes" className={classeCartao}>
        <h2 id="titulo-minhas-permissoes" className="mb-3 text-lg font-semibold">
          Minhas permissões
        </h2>
        {permissoes.length === 0 ? (
          <p className="text-sm text-texto-secundario">
            Nenhuma permissão por projeto ou tema. {usuario.administrador && "Como administrador, você tem acesso integral."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda text-sm">
            {permissoes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                <Link href={`/projetos-temas/${p.projetoTemaId}`} className={classeLink}>
                  {p.projetoNome}
                </Link>
                <span>· {ROTULOS_PERFIL[p.perfil]}</span>
                {p.validaAte && <SeloSituacao tom="neutro">Até {formatarData(p.validaAte)}</SeloSituacao>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {modoDeAcesso() === "supabase" && (
        <section aria-labelledby="titulo-senha" className={classeCartao}>
          <h2 id="titulo-senha" className="mb-4 text-lg font-semibold">
            Trocar a senha
          </h2>
          <FormularioTrocaSenha />
        </section>
      )}
    </>
  );
}
