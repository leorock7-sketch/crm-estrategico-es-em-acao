import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança em todas as respostas (Etapa 7B, D-087): HTTPS obrigatório, sem embutir o
 * CRM em outras páginas, sem adivinhação de tipo de arquivo, sem vazar endereços internos para
 * outros sites e fora dos buscadores (o CRM não é público).
 */
const CABECALHOS_DE_SEGURANCA = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // O PGlite carrega arquivos próprios (WebAssembly) e não pode ser empacotado.
  serverExternalPackages: ["@electric-sql/pglite", "write-excel-file"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS_DE_SEGURANCA }];
  },
};

export default nextConfig;
