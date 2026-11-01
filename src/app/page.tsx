import { SeloSituacao } from "@/componentes/selo-situacao";

export default function PaginaInicial() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl rounded-2xl border border-borda bg-superficie p-8 shadow-sm sm:p-12">
        <SeloSituacao>Em desenvolvimento</SeloSituacao>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
          CRM Estratégico — ES em Ação
        </h1>

        <p className="mt-4 text-lg leading-relaxed text-texto-secundario">
          Sistema de gestão estratégica de relacionamentos institucionais do
          ES em Ação: stakeholders, projetos, iniciativas, interações, planos de
          ação e riscos.
        </p>

        <p className="mt-8 border-t border-borda pt-6 text-sm text-texto-secundario">
          Esta aplicação está em desenvolvimento (Etapa 0 — Fundação Técnica).
          Nenhum módulo está disponível ainda e o ambiente de testes utiliza
          exclusivamente dados fictícios.
        </p>
      </div>
    </main>
  );
}
