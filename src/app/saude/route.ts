/**
 * Verificação de funcionamento para o monitoramento (D-082). Confere que a aplicação responde e que
 * consegue consultar o banco (lib/banco/requisicao.ts, bancoResponde). Não usa sessão e não devolve
 * nenhuma informação além da situação.
 */
import { bancoResponde } from "@/lib/banco/requisicao";

const SEM_CACHE = { "Cache-Control": "no-store" };

export async function GET() {
  return (await bancoResponde())
    ? Response.json({ situacao: "ok" }, { headers: SEM_CACHE })
    : Response.json({ situacao: "indisponivel" }, { status: 503, headers: SEM_CACHE });
}
