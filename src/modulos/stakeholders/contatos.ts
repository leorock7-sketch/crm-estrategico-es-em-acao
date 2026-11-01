/**
 * Regras dos contatos (decisão D-025) que não dependem do banco: normalização
 * para comparação e validação do valor conforme o tipo.
 */
import { normalizarTexto } from "@/lib/texto";
import type { TIPOS_CONTATO } from "./rotulos";

export type TipoContato = (typeof TIPOS_CONTATO)[number];

/** Forma usada para comparar contatos e detectar repetições. */
export function normalizarContato(tipo: TipoContato, valor: string): string {
  const texto = valor.trim();
  switch (tipo) {
    case "email":
    case "site":
      return texto.toLowerCase().replace(/\/+$/, "");
    case "telefone":
    case "celular":
      return texto.replace(/\D/g, "");
    default:
      return normalizarTexto(texto);
  }
}

/** Mensagem de erro do valor, ou null se estiver correto para o tipo. */
export function erroDoValorContato(tipo: TipoContato, valor: string): string | null {
  const texto = valor.trim();
  if (!texto) return "Informe o contato.";
  if (texto.length > 300) return "O contato deve ter no máximo 300 caracteres.";
  switch (tipo) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto) ? null : "E-mail inválido.";
    case "telefone":
    case "celular": {
      const digitos = texto.replace(/\D/g, "").length;
      return digitos >= 8 && digitos <= 15 ? null : "Telefone inválido: informe de 8 a 15 dígitos, com DDD.";
    }
    case "site":
      return /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(texto) ? null : "Site inválido. Comece com http:// ou https://.";
    default:
      return null;
  }
}
