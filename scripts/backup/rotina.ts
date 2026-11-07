/**
 * Rotina diária de cópias (D-084), executada pelo Agendador de Tarefas do Windows às 12:30, com o
 * usuário conectado (scripts/backup/rotina-diaria.ps1). Comandos: npm run backup:rotina e, só para
 * conferir os destinos, npm run backup:conferir.
 *
 * 1. Trava contra execuções simultâneas; uma cópia da rotina por dia (execução atrasada não duplica).
 * 2. Cópia criptografada pelo comando de cópia (só do banco de desenvolvimento, identificado como
 *    descartável). Em falha, nenhuma cópia anterior é tocada.
 * 3. Conferência de TODAS as cópias nos dois destinos (resumos SHA-256 contra o manifesto, só arquivos
 *    criptografados) e da correspondência entre a pasta local e a do Google Drive.
 * 4. Conferência do monitor do GitHub (npm run monitor:conferir), sem alterar nada nele.
 * 5. Pendências: ensaio de restauração com mais de 31 dias e chave privada ainda não conferida.
 *
 * Registro em registro-rotina.log, na pasta local: data, etapa, resultado, duração, categoria e nome da
 * cópia. Termina com 0 (tudo certo), 2 (pendência a avisar) ou 1 (falha: aviso visível no Windows).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { exigir, mascarar } from "./comum";
import {
  adquirirTrava,
  chaveConferida,
  conferirDestino,
  DIAS_ENSAIO,
  diasDesdeUltimoEnsaio,
  divergenciasEntreDestinos,
  jaHouveCopiaDaRotinaHoje,
  lerRegistros,
  liberarTrava,
  type Registro,
  registrar,
} from "./rotina-regras";

const local = exigir("CRM_BACKUP_PASTA_LOCAL");
const nuvem = exigir("CRM_BACKUP_PASTA_NUVEM");
const soConferir = process.argv.includes("--so-conferir");
const forcar = process.argv.includes("--forcar");

function executarNode(argumentos: string[]) {
  const r = spawnSync(process.execPath, argumentos, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  return { codigo: r.status ?? 1, saida: `${r.stdout ?? ""}\n${r.stderr ?? ""}` };
}

function conferirCopias(): Registro[] {
  const inicio = Date.now();
  const situacaoLocal = conferirDestino(local);
  const situacaoNuvem = conferirDestino(nuvem);
  const divergencias = divergenciasEntreDestinos(situacaoLocal, situacaoNuvem);
  const problemas = [...situacaoLocal.problemas.map((p) => `local ${p.nome}: ${p.motivo}`), ...situacaoNuvem.problemas.map((p) => `Google Drive ${p.nome}: ${p.motivo}`), ...divergencias];
  for (const p of problemas) console.log(`  - ${p}`);
  console.log(`[${problemas.length === 0 ? "OK" : "PROBLEMA"}] Cópias íntegras: ${situacaoLocal.integras.length} na pasta local e ${situacaoNuvem.integras.length} no Google Drive; ${problemas.length} problema(s).`);
  const categoria = situacaoLocal.problemas.length + situacaoNuvem.problemas.length > 0 ? "copia-com-problema" : divergencias.length > 0 ? "destinos-divergentes" : null;
  const semCopia = situacaoLocal.integras.length === 0 || situacaoNuvem.integras.length === 0;
  return [
    registrar(local, {
      etapa: "conferencia",
      resultado: problemas.length === 0 && !semCopia ? "ok" : "falha",
      duracao_ms: Date.now() - inicio,
      categoria: semCopia ? "sem-copia-integra" : categoria,
    }),
  ];
}

function principal(): number {
  if (soConferir) return conferirCopias().some((r) => r.resultado === "falha") ? 1 : 0;

  if (!adquirirTrava(local)) {
    registrar(local, { etapa: "rotina", resultado: "ignorada", duracao_ms: null, categoria: "outra-execucao-em-andamento" });
    console.log("RESULTADO|ok|outra-execucao-em-andamento");
    return 0;
  }
  const resultados: Registro[] = [];
  try {
    const registros = lerRegistros(local);

    // 1 e 2. Cópia do dia.
    if (!forcar && jaHouveCopiaDaRotinaHoje(registros)) {
      resultados.push(registrar(local, { etapa: "copia-rotina", resultado: "ignorada", duracao_ms: null, categoria: "ja-houve-copia-hoje" }));
      console.log("[OK] A cópia de hoje já foi feita pela rotina; nada a duplicar.");
    } else {
      const inicio = Date.now();
      const copia = executarNode([path.join("node_modules", "tsx", "dist", "cli.mjs"), path.join("scripts", "backup", "backup.ts")]);
      const nome = /COPIA\|(crm-backup-[0-9T-]+)/.exec(copia.saida)?.[1];
      for (const l of copia.saida.split("\n").filter((x) => /^\[|^Falha/.test(x))) console.log(mascarar(l).slice(0, 220));
      resultados.push(
        registrar(local, {
          etapa: "copia-rotina",
          resultado: copia.codigo === 0 && nome ? "ok" : "falha",
          duracao_ms: Date.now() - inicio,
          categoria: copia.codigo === 0 && nome ? null : "falha-na-copia",
          ...(nome ? { copia: nome } : {}),
        }),
      );
    }

    // 3. Integridade de todas as cópias e correspondência entre os destinos.
    resultados.push(...conferirCopias());

    // 4. Monitor do GitHub (somente leitura).
    const inicioMonitor = Date.now();
    const monitor = executarNode([path.join("scripts", "monitor", "conferir-automacao.mjs")]);
    let problemasMonitor: string[] = ["consulta-indisponivel"];
    try {
      const linha = monitor.saida.split("\n").find((l) => l.startsWith("{"));
      problemasMonitor = (JSON.parse(linha ?? "{}") as { problemas?: string[] }).problemas ?? ["consulta-indisponivel"];
    } catch {
      // Mantém a categoria de consulta indisponível.
    }
    resultados.push(
      registrar(local, { etapa: "monitor", resultado: problemasMonitor.length === 0 ? "ok" : "alerta", duracao_ms: Date.now() - inicioMonitor, categoria: problemasMonitor.join(",") || null }),
    );

    // 5. Pendências.
    const dias = diasDesdeUltimoEnsaio(lerRegistros(local));
    if (dias === null || dias > DIAS_ENSAIO) {
      resultados.push(registrar(local, { etapa: "ensaio-mensal", resultado: "alerta", duracao_ms: null, categoria: dias === null ? "ensaio-nunca-registrado" : `ensaio-ha-${dias}-dias` }));
    }
    if (!chaveConferida(lerRegistros(local))) {
      resultados.push(registrar(local, { etapa: "chave", resultado: "alerta", duracao_ms: null, categoria: "chave-privada-nao-conferida" }));
    }
  } finally {
    liberarTrava(local);
  }

  const falhas = resultados.filter((r) => r.resultado === "falha");
  const alertas = resultados.filter((r) => r.resultado === "alerta");
  const situacao = falhas.length > 0 ? "falha" : alertas.length > 0 ? "alerta" : "ok";
  console.log(`RESULTADO|${situacao}|${[...falhas, ...alertas].map((r) => r.categoria).join(",")}`);
  return falhas.length > 0 ? 1 : alertas.length > 0 ? 2 : 0;
}

try {
  process.exitCode = principal();
} catch (erro) {
  const categoria = "erro-na-rotina";
  try {
    registrar(local, { etapa: "rotina", resultado: "falha", duracao_ms: null, categoria });
  } catch {
    // Sem como registrar; o aviso visível ainda é exibido pela tarefa.
  }
  console.error(`Falha na rotina: ${mascarar(erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido").slice(0, 200)}`);
  console.log(`RESULTADO|falha|${categoria}`);
  process.exitCode = 1;
}
