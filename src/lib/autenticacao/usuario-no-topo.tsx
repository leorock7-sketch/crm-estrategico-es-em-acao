import Link from "next/link";
import { connection } from "next/server";
import { modoDeAcesso } from "@/lib/banco/ambiente";
import { sair } from "./acoes";

/** Quem está conectado, com os atalhos da conta. Sem sessão, não mostra nada. */
export async function UsuarioNoTopo() {
  await connection();
  if (modoDeAcesso() === "local") {
    return <span className="text-xs text-texto-secundario">Modo local, sem login</span>;
  }
  const { consultarSessao } = await import("./sessao");
  const sessao = await consultarSessao();
  if (sessao.tipo !== "ativa") return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {sessao.usuario.administrador && (
        <Link href="/usuarios" className="hover:underline">
          Usuários
        </Link>
      )}
      <Link href="/minha-conta" className="hover:underline" data-teste="usuario-conectado">
        {sessao.usuario.nome}
      </Link>
      <form action={sair}>
        <button type="submit" className="text-texto-secundario hover:underline">
          Sair
        </button>
      </form>
    </div>
  );
}
