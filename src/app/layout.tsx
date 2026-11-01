import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Estratégico — ES em Ação",
  description:
    "Sistema de gestão estratégica de relacionamentos institucionais do ES em Ação (em desenvolvimento).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
