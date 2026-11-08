// @vitest-environment node
/**
 * Correções de consistência do piloto (D-089), apontadas na validação independente de 08/11/2026.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { AVISO_SEGURANCA } from "@/modulos/avaliacoes/rotulos";
import { ROTULO_SEM_SITUACAO, ROTULOS_SITUACAO_ACAO, rotuloDaSituacaoAcao, SITUACOES_ACAO } from "@/modulos/plano-acao/rotulos";

describe("V-01: situação da ação sem acompanhamento", () => {
  test("sem registro aparece como 'Sem situação registrada', e não como 'Não iniciada'", () => {
    expect(rotuloDaSituacaoAcao(null)).toBe("Sem situação registrada");
    expect(ROTULO_SEM_SITUACAO).not.toBe(ROTULOS_SITUACAO_ACAO.nao_iniciada);
  });

  test("situações registradas mantêm os rótulos de sempre", () => {
    for (const s of SITUACOES_ACAO) expect(rotuloDaSituacaoAcao(s)).toBe(ROTULOS_SITUACAO_ACAO[s]);
  });

  test("tela do plano, página da ação e relatório usam a mesma regra", () => {
    for (const arquivo of ["src/modulos/plano-acao/componentes/selos.tsx", "src/app/acoes/[id]/page.tsx", "src/modulos/paineis/relatorios.ts"]) {
      const fonte = readFileSync(arquivo, "utf8");
      expect(fonte).toContain("rotuloDaSituacaoAcao(");
      expect(fonte).not.toMatch(/\?\? "nao_iniciada"/);
    }
  });
});

describe("Avisos atualizados", () => {
  test("o aviso de segurança não afirma mais a ausência de autenticação e de regras no banco", () => {
    expect(AVISO_SEGURANCA).not.toMatch(/não há autenticação real|não foi homologada/);
    expect(AVISO_SEGURANCA).toContain("dados fictícios");
  });

  test("a página inicial não cita mais a Etapa 4 nem metodologia apenas de demonstração", () => {
    const inicio = readFileSync("src/app/page.tsx", "utf8");
    expect(inicio).not.toContain("Etapa 4");
    expect(inicio).not.toContain("apenas demonstrações não homologadas");
    expect(inicio).toContain("somente com dados fictícios");
  });
});
