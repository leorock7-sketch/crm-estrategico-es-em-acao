import { classeLink } from "@/componentes/estilos";
import { SeloSituacao } from "@/componentes/selo-situacao";
import { descreverPeriodo } from "@/lib/formatacao";
import { arquivarContatoAcao } from "../acoes";
import type { ContatoListado } from "../consultas";
import { ROTULOS_NATUREZA_CONTATO, ROTULOS_TIPO_CONTATO } from "../rotulos";
import { FormularioEncerramento } from "./formulario-encerramento";

/** Endereço de link para o contato (e-mail, telefone ou site); null para os demais. */
function enderecoDoContato(contato: ContatoListado): string | null {
  switch (contato.tipo) {
    case "email":
      return `mailto:${contato.valor}`;
    case "telefone":
    case "celular":
      return `tel:${contato.valor.replace(/[^\d+]/g, "")}`;
    case "site":
      // Só sites validados com http:// ou https:// chegam aqui.
      return /^https?:\/\//i.test(contato.valor) ? contato.valor : null;
    default:
      return null;
  }
}

/** Contatos com natureza, vínculo e período; permite encerrar e arquivar. */
export function ListaContatos({
  contatos,
  somenteLeitura,
}: {
  contatos: ContatoListado[];
  /** Cadastro arquivado: contatos visíveis, sem ações. */
  somenteLeitura: boolean;
}) {
  if (contatos.length === 0) {
    return <p className="text-sm text-texto-secundario">Nenhum contato registrado.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-borda">
      {contatos.map((contato) => {
        const vigente = contato.dataFim === null;
        const endereco = enderecoDoContato(contato);
        return (
          <li key={contato.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                {ROTULOS_TIPO_CONTATO[contato.tipo]}
              </span>
              {endereco ? (
                <a href={endereco} className={`${classeLink} break-all`} rel="noopener noreferrer">
                  {contato.valor}
                </a>
              ) : (
                <span className="break-all">{contato.valor}</span>
              )}
              {vigente ? (
                <SeloSituacao tom="sucesso">Vigente</SeloSituacao>
              ) : (
                <SeloSituacao tom="neutro">Encerrado</SeloSituacao>
              )}
              {contato.principal && vigente && <SeloSituacao tom="aviso">Principal</SeloSituacao>}
            </div>
            <p className="mt-1 text-sm">
              {ROTULOS_NATUREZA_CONTATO[contato.natureza]}
              {contato.vinculoId &&
                ` · ligado a ${[contato.vinculoCargo, contato.vinculoInstituicao].filter(Boolean).join(" · ")}`}
            </p>
            <p className="text-xs text-texto-secundario">
              {descreverPeriodo(contato.dataInicio, contato.dataFim)}
              {contato.observacao && ` · ${contato.observacao}`}
            </p>
            {!somenteLeitura && (
              <div className="mt-2 flex flex-wrap items-start gap-4 text-sm">
                {vigente && (
                  <details>
                    <summary className="cursor-pointer text-texto-secundario hover:underline">
                      Encerrar contato
                    </summary>
                    <FormularioEncerramento alvo="contato" id={contato.id} />
                  </details>
                )}
                <form action={arquivarContatoAcao.bind(null, contato.id)}>
                  <button type="submit" className="text-texto-secundario hover:underline">
                    Arquivar (registrado por engano)
                  </button>
                </form>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
