// @vitest-environment node
/**
 * Autorização por projeto ou tema (D-008, RN-03), com usuários fictícios.
 * Estrutura preparada para a etapa de autenticação; a segurança multiusuário
 * ainda não está homologada (D-034).
 */
import { beforeAll, describe, expect, test } from "vitest";
import { abrirBanco, type Banco, comoUsuario } from "@/lib/banco/conexao";
import { comite, permissaoContexto, usuario } from "@/lib/banco/esquema";
import { AcessoNegadoError, exigirPermissao, permissaoDoUsuarioDaSessao, permissaoNoContexto } from "@/modulos/acesso/permissoes";
import { obterUsuarioAtual } from "@/modulos/acesso/usuario-atual";
import { criarProjetoTema } from "@/modulos/projetos-temas/consultas";

let banco: Banco;
let administradorId: string;
let projetoA: string;
let projetoB: string;
const usuarios: Record<string, string> = {};

async function criarUsuario(chave: string, opcoes: { situacao?: "ativo" | "inativo" } = {}) {
  const [novo] = await banco
    .insert(usuario)
    .values({ nome: `Usuário fictício ${chave}`, email: `${chave}@exemplo.invalid`, situacao: opcoes.situacao ?? "ativo" })
    .returning({ id: usuario.id });
  usuarios[chave] = novo.id;
}

beforeAll(async () => {
  banco = await abrirBanco();
  administradorId = (await obterUsuarioAtual(banco)).id;
  const [{ id: comiteId }] = await banco.select({ id: comite.id }).from(comite).limit(1);
  [projetoA, projetoB] = await comoUsuario(banco, administradorId, async (tx) => [
    await criarProjetoTema(tx, { tipo: "projeto", nome: "Projeto Restrito Fictício A", comiteId, situacao: "ativo" }),
    await criarProjetoTema(tx, { tipo: "projeto", nome: "Projeto Restrito Fictício B", comiteId, situacao: "ativo" }),
  ]);
  for (const chave of ["gestor", "colaborador", "leitor", "semPermissao", "vencida", "arquivada"]) await criarUsuario(chave);
  await criarUsuario("inativo", { situacao: "inativo" });
  await comoUsuario(banco, administradorId, (tx) =>
    tx.insert(permissaoContexto).values([
      { usuarioId: usuarios.gestor, projetoTemaId: projetoA, perfil: "gestor" },
      { usuarioId: usuarios.colaborador, projetoTemaId: projetoA, perfil: "colaborador" },
      { usuarioId: usuarios.leitor, projetoTemaId: projetoA, perfil: "leitor" },
      { usuarioId: usuarios.vencida, projetoTemaId: projetoA, perfil: "gestor", validaAte: "2020-01-31" },
      { usuarioId: usuarios.arquivada, projetoTemaId: projetoA, perfil: "gestor", arquivadoEm: new Date() },
      { usuarioId: usuarios.inativo, projetoTemaId: projetoA, perfil: "gestor" },
    ]),
  );
}, 60_000);

describe("Permissões por contexto", () => {
  test("administrador vê e altera todos os contextos", async () => {
    expect(await permissaoNoContexto(banco, administradorId, projetoA)).toEqual({ ver: true, editar: true, origem: "administrador" });
    expect((await permissaoNoContexto(banco, administradorId, projetoB)).editar).toBe(true);
  });

  test("gestor e colaborador veem e alteram; leitor só vê", async () => {
    expect(await permissaoNoContexto(banco, usuarios.gestor, projetoA)).toEqual({ ver: true, editar: true, origem: "gestor" });
    expect(await permissaoNoContexto(banco, usuarios.colaborador, projetoA)).toEqual({
      ver: true,
      editar: true,
      origem: "colaborador",
    });
    expect(await permissaoNoContexto(banco, usuarios.leitor, projetoA)).toEqual({ ver: true, editar: false, origem: "leitor" });
  });

  test("permissão em um contexto não vale para outro (T05)", async () => {
    expect(await permissaoNoContexto(banco, usuarios.gestor, projetoB)).toEqual({
      ver: false,
      editar: false,
      origem: "sem_permissao",
    });
  });

  test("sem permissão, com permissão vencida ou arquivada, ou usuário inativo: nada", async () => {
    for (const chave of ["semPermissao", "vencida", "arquivada"]) {
      expect((await permissaoNoContexto(banco, usuarios[chave], projetoA)).ver).toBe(false);
    }
    expect(await permissaoNoContexto(banco, usuarios.inativo, projetoA)).toEqual({
      ver: false,
      editar: false,
      origem: "usuario_inativo",
    });
  });

  test("P-071: a permissão com os dados da sessão coincide com a lida do cadastro, em todos os perfis", async () => {
    const casos: [string, boolean][] = [
      [administradorId, true],
      ...["gestor", "colaborador", "leitor", "semPermissao", "vencida", "arquivada"].map((c) => [usuarios[c], false] as [string, boolean]),
    ];
    for (const projeto of [projetoA, projetoB]) {
      for (const [id, administrador] of casos) {
        expect(await permissaoDoUsuarioDaSessao(banco, { id, administrador }, projeto)).toEqual(await permissaoNoContexto(banco, id, projeto));
      }
      // Sem a informação da sessão (modo local), consulta o cadastro como antes.
      expect(await permissaoDoUsuarioDaSessao(banco, { id: usuarios.leitor }, projeto)).toEqual(await permissaoNoContexto(banco, usuarios.leitor, projeto));
    }
  });

  test("exigirPermissao recusa a ação não autorizada com mensagem clara", async () => {
    await expect(exigirPermissao(banco, usuarios.leitor, projetoA, "editar")).rejects.toBeInstanceOf(AcessoNegadoError);
    await expect(exigirPermissao(banco, usuarios.semPermissao, projetoA, "ver")).rejects.toThrow(
      "Você não tem permissão para ver as avaliações deste projeto ou tema.",
    );
    await expect(exigirPermissao(banco, usuarios.leitor, projetoA, "ver")).resolves.toMatchObject({ origem: "leitor" });
  });

  test("um usuário tem no máximo uma permissão ativa por contexto", async () => {
    await expect(
      comoUsuario(banco, administradorId, (tx) =>
        tx.insert(permissaoContexto).values({ usuarioId: usuarios.leitor, projetoTemaId: projetoA, perfil: "gestor" }),
      ),
    ).rejects.toThrow();
  });
});
