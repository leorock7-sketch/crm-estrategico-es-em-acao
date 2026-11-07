import Link from "next/link";
import { Alerta } from "@/componentes/alerta";
import { classeLink } from "@/componentes/estilos";
import { MENSAGEM_SOMENTE_CONSULTA } from "../capacidades";

/**
 * Página de inclusão ou alteração aberta, por endereço direto, por quem só pode consultar
 * (pendência da D-078). Nenhum formulário chega ao navegador; a recusa efetiva continua nas
 * operações do servidor e nas regras do banco.
 */
export function SomenteConsulta({ voltar }: { voltar: { href: string; rotulo: string } }) {
  return (
    <div className="flex flex-col gap-4" data-teste="somente-consulta">
      <Alerta tom="aviso">{MENSAGEM_SOMENTE_CONSULTA}</Alerta>
      <p>
        <Link href={voltar.href} className={classeLink}>
          Voltar: {voltar.rotulo}
        </Link>
      </p>
    </div>
  );
}
