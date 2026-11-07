import { z } from "zod";
import { esquemaIdentificador } from "@/lib/validacao/comuns";

const nome = z.string().trim().min(2, "Informe o nome.").max(200, "Use no máximo 200 caracteres.");
const marcado = z.preprocess((valor) => valor === "on" || valor === "sim", z.boolean());

export const esquemaNovoUsuario = z.object({
  nome,
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  administrador: marcado,
});

export const esquemaEdicaoUsuario = z.object({
  usuarioId: esquemaIdentificador,
  nome,
  administrador: marcado,
});

export const PERFIS_CONTEXTO = ["gestor", "colaborador", "leitor"] as const;

export const ROTULOS_PERFIL: Record<(typeof PERFIS_CONTEXTO)[number], string> = {
  gestor: "Gestor",
  colaborador: "Colaborador",
  leitor: "Leitor",
};

export const DESCRICOES_PERFIL: Record<(typeof PERFIS_CONTEXTO)[number], string> = {
  gestor: "Consulta, registra, altera e decide sobre versões do plano neste projeto ou tema.",
  colaborador: "Consulta, registra e altera neste projeto ou tema; não decide sobre versões do plano.",
  leitor: "Somente consulta as informações deste projeto ou tema.",
};

export const esquemaPermissao = z.object({
  usuarioId: esquemaIdentificador,
  projetoTemaId: esquemaIdentificador,
  perfil: z.enum(PERFIS_CONTEXTO, { error: "Selecione o perfil." }),
  validaAte: z.preprocess((valor) => (valor === "" ? undefined : valor), z.iso.date({ error: "Data inválida." }).optional()),
});

export const esquemaRevogacao = z.object({
  usuarioId: esquemaIdentificador,
  permissaoId: esquemaIdentificador,
});

export const esquemaSomenteUsuario = z.object({ usuarioId: esquemaIdentificador });
