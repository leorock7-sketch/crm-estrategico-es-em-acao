import Link from "next/link";
import { classeBotaoSecundario } from "@/componentes/estilos";

export default function NaoEncontrado() {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <h1 className="text-2xl font-semibold">Página ou registro não encontrado</h1>
      <p className="mt-2 text-texto-secundario">
        O endereço pode estar incorreto, ou o registro não existe neste banco de dados.
      </p>
      <Link href="/" className={`${classeBotaoSecundario} mt-6`}>
        Voltar ao início
      </Link>
    </div>
  );
}
