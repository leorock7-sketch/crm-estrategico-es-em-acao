/**
 * Download dos relatórios R1 a R5. A permissão é decidida aqui, no servidor, a cada chamada: não
 * depende de botão visível na tela. Sem sessão, leva ao login; leitor recebe recusa (D-079).
 */
import type { NextRequest } from "next/server";
import { hojeEmBrasilia } from "@/lib/formatacao";
import { bancoDaSessao } from "@/lib/banco/requisicao";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { carregarDadosDoPainel } from "@/modulos/paineis/dados";
import { lerFiltros } from "@/modulos/paineis/filtros";
import { ehCodigoRelatorio, escopoDeExportacao, montarRelatorio } from "@/modulos/paineis/relatorios";
import { gerarXlsx } from "@/modulos/paineis/xlsx";

export async function GET(requisicao: NextRequest, contexto: RouteContext<"/paineis/relatorios/[codigo]">) {
  const { codigo } = await contexto.params;
  if (!ehCodigoRelatorio(codigo)) return new Response("Relatório não encontrado.", { status: 404 });

  const banco = await bancoDaSessao();
  const hoje = hojeEmBrasilia();
  // P-071, E3: a permissão e a leitura dos dados correm em paralelo; a decisão é a mesma de antes e vem
  // primeiro. Sem permissão, a resposta é a recusa, e o que foi lido (só o que as regras de acesso do
  // banco permitem a esse usuário) é descartado sem sair do servidor; uma falha na leitura não muda a recusa.
  // O nome do usuário (para a aba de extração) também vem em paralelo: numa rota, o cache da sessão por
  // requisição do React não vale, e a identificação seria refeita só depois da leitura.
  const [permissao, leitura, responsavel] = await Promise.allSettled([
    escopoDeExportacao(banco),
    carregarDadosDoPainel(banco, hoje),
    obterUsuarioAtual(banco),
  ]);
  if (permissao.status === "rejected") throw permissao.reason;
  const escopo = permissao.value;
  if (!escopo.podeExportar) {
    return new Response("Seu perfil permite consultar os painéis, mas não exportar relatórios pelo sistema.", { status: 403 });
  }
  if (leitura.status === "rejected") throw leitura.reason;
  if (responsavel.status === "rejected") throw responsavel.reason;
  const dados = leitura.value;
  const usuario = responsavel.value;
  const { filtros } = lerFiltros(Object.fromEntries(requisicao.nextUrl.searchParams));
  const arquivo = montarRelatorio(codigo, dados, escopo, filtros, { hoje, extraidoEm: new Date(), usuario: usuario.nome });
  const conteudo = await gerarXlsx(arquivo);
  return new Response(new Uint8Array(conteudo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${arquivo.nomeArquivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
