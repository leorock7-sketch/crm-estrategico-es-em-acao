import { formatarDataHora } from "@/lib/formatacao";
import type { RegistroHistorico } from "../consultas";
import { alteracoesEntre } from "../historico";
import { ROTULOS_OPERACAO } from "../rotulos";

type Dados = Record<string, unknown> | null;

type PropriedadesHistorico = {
  registros: RegistroHistorico[];
  nomes: Map<string, string>;
  /** Do ponto de vista de quem é o histórico: define como os vínculos são descritos. */
  perspectiva: "pessoa" | "instituicao";
};

function descreverRegistro(
  registro: RegistroHistorico,
  nomes: Map<string, string>,
  perspectiva: PropriedadesHistorico["perspectiva"],
) {
  if (registro.tabela !== "vinculo_pessoa_instituicao") return "Cadastro";
  const dados = (registro.dadosNovos ?? registro.dadosAnteriores) as Dados;
  const outroId = String(dados?.[perspectiva === "pessoa" ? "instituicao_id" : "pessoa_id"] ?? "");
  const nome = nomes.get(outroId) ?? "registro não identificado";
  return perspectiva === "pessoa" ? `Vínculo com ${nome}` : `Vínculo de ${nome}`;
}

/** Trilha de auditoria: quem fez, quando e o que mudou. */
export function ListaHistorico({ registros, nomes, perspectiva }: PropriedadesHistorico) {
  if (registros.length === 0) {
    return <p className="text-sm text-texto-secundario">Nenhum registro no histórico.</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {registros.map((registro) => {
        const alteracoes =
          registro.operacao === "arquivamento" || registro.operacao === "reativacao"
            ? []
            : alteracoesEntre(
                registro.dadosAnteriores as Dados,
                registro.dadosNovos as Dados,
                nomes,
              );
        return (
          <li key={registro.id} className="border-l-2 border-borda pl-4">
            <p className="text-sm">
              <span className="font-medium">{ROTULOS_OPERACAO[registro.operacao]}</span>
              {" · "}
              {descreverRegistro(registro, nomes, perspectiva)}
            </p>
            <p className="text-xs text-texto-secundario">
              {formatarDataHora(registro.ocorridoEm)} · {registro.usuarioNome ?? "carga inicial"}
            </p>
            {alteracoes.length > 0 && (
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">
                {alteracoes.map((alteracao) => (
                  <div key={alteracao.campo} className="contents">
                    <dt className="text-texto-secundario">{alteracao.rotulo}</dt>
                    <dd className="break-words">
                      {registro.operacao === "inclusao" ? (
                        alteracao.depois
                      ) : (
                        <>
                          <span className="line-through decoration-texto-secundario/60">
                            {alteracao.antes}
                          </span>{" "}
                          → {alteracao.depois}
                        </>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        );
      })}
    </ol>
  );
}
