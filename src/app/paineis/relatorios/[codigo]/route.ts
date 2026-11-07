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
  const escopo = await escopoDeExportacao(banco);
  if (!escopo.podeExportar) {
    return new Response("Seu perfil permite consultar os painéis, mas não exportar relatórios pelo sistema.", { status: 403 });
  }

  const usuario = await obterUsuarioAtual(banco);
  const { filtros } = lerFiltros(Object.fromEntries(requisicao.nextUrl.searchParams));
  const hoje = hojeEmBrasilia();
  const dados = await carregarDadosDoPainel(banco, hoje);
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
