import { formatarDataHora } from "@/lib/formatacao";
import type { RegistroHistorico } from "../consultas";
import { alteracoesEntre } from "../historico";
import { ROTULOS_TIPO_RELACAO } from "@/modulos/projetos-temas/rotulos";
import { ROTULOS_OPERACAO, ROTULOS_TIPO_CONTATO } from "../rotulos";

type Dados = Record<string, unknown> | null;

type PropriedadesHistorico = {
  registros: RegistroHistorico[];
  nomes: Map<string, string>;
  /** Do ponto de vista de quem é o histórico: define como os vínculos são descritos. */
  perspectiva: "pessoa" | "instituicao" | "projeto";
};

function descreverRegistro(
  registro: RegistroHistorico,
  nomes: Map<string, string>,
  perspectiva: PropriedadesHistorico["perspectiva"],
) {
  const dados = (registro.dadosNovos ?? registro.dadosAnteriores) as Dados;
  if (registro.tabela === "contato") {
    const tipo = ROTULOS_TIPO_CONTATO[String(dados?.tipo) as keyof typeof ROTULOS_TIPO_CONTATO];
    return `Contato (${tipo ?? "contato"}): ${String(dados?.valor ?? "")}`;
  }
  if (registro.tabela === "projeto_tema_comite") {
    return `Comitê participante: ${nomes.get(String(dados?.comite_id ?? "")) ?? "registro não identificado"}`;
  }
  if (registro.tabela === "stakeholder_contexto") {
    const tipo = ROTULOS_TIPO_RELACAO[String(dados?.tipo_relacao) as keyof typeof ROTULOS_TIPO_RELACAO];
    const campo = perspectiva === "projeto" ? "stakeholder_id" : "projeto_tema_id";
    const nome = nomes.get(String(dados?.[campo] ?? "")) ?? "registro não identificado";
    return perspectiva === "projeto"
      ? `Stakeholder: ${nome} (${tipo ?? "relação"})`
      : `Relação com ${nome} (${tipo ?? "relação"})`;
  }
  if (registro.tabela !== "vinculo_pessoa_instituicao" || perspectiva === "projeto") return "Cadastro";
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
