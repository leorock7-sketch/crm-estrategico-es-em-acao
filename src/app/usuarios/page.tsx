import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Carregando } from "@/componentes/carregando";
import { classeBotaoPrimario, classeCelula, classeCelulaCabecalho, classeLink, classeTabela } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { bancoDaRequisicao } from "@/lib/banco/requisicao";
import { ehAdministrador } from "@/modulos/acesso/capacidades";
import { SeAdministrador } from "@/modulos/acesso/componentes/conforme-perfil";
import { listarUsuarios } from "@/modulos/acesso/usuarios";

export const metadata: Metadata = { title: "Usuários" };

export default function PaginaUsuarios() {
  return (
    <>
      <CabecalhoPagina
        titulo="Usuários e permissões"
        descricao="Acesso fechado: só entra quem foi cadastrado aqui e está ativo. As permissões valem por projeto ou tema."
        acoes={
          <SeAdministrador>
            <Link href="/usuarios/novo" className={classeBotaoPrimario}>
              Novo usuário
            </Link>
          </SeAdministrador>
        }
      />
      <Suspense fallback={<Carregando />}>
        <ListaUsuarios />
      </Suspense>
    </>
  );
}

async function ListaUsuarios() {
  const banco = await bancoDaRequisicao();
  if (!(await ehAdministrador(banco))) notFound();
  const usuarios = await listarUsuarios(banco);
  return (
    <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
      <table className={classeTabela}>
        <thead>
          <tr>
            <th scope="col" className={classeCelulaCabecalho}>Nome</th>
            <th scope="col" className={classeCelulaCabecalho}>E-mail</th>
            <th scope="col" className={classeCelulaCabecalho}>Perfil</th>
            <th scope="col" className={classeCelulaCabecalho}>Permissões válidas</th>
            <th scope="col" className={classeCelulaCabecalho}>Situação</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td className={classeCelula}>
                <Link href={`/usuarios/${u.id}`} className={classeLink}>
                  {u.nome}
                </Link>
              </td>
              <td className={classeCelula}>{u.email}</td>
              <td className={classeCelula}>{u.administrador ? "Administrador" : "Por projeto ou tema"}</td>
              <td className={classeCelula}>{u.administrador ? "Todas" : u.permissoes}</td>
              <td className={classeCelula}>
                <span className="flex flex-wrap gap-1">
                  {u.situacao === "ativo" ? <SeloSituacao tom="sucesso">Ativo</SeloSituacao> : <SeloSituacao tom="neutro">Inativo</SeloSituacao>}
                  {!u.comConta && <SeloSituacao tom="aviso">Sem conta de acesso</SeloSituacao>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
