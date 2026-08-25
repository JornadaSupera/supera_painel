import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Breadcrumb } from "@/components/shared";
import { MenuMobile } from "./MenuMobile";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { itemPorCaminho, trilhaPorCaminho } from "./navegacao";

/**
 * Moldura do painel: sidebar + topbar + área de conteúdo.
 *
 * Fica entre `ProtectedRoute` e as páginas, para que só quem tem sessão veja a
 * navegação — e para que a sidebar não remonte a cada troca de rota.
 */
export function AdminLayout() {
  const location = useLocation();
  const trilha = trilhaPorCaminho(location.pathname);

  /* O título da aba acompanha a tela: com várias abas abertas, "Jornada
     Supera" repetido não ajuda ninguém a se localizar. */
  useEffect(() => {
    const item = itemPorCaminho(location.pathname);
    const nome = item?.titulo ?? item?.label;
    document.title = nome ? `${nome} · Jornada Supera` : "Jornada Supera · Administração";
  }, [location.pathname]);

  /* Trocar de página devolve o scroll ao topo. Sem isso, abrir uma tela nova
     no meio dela é desorientador. */
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="bg-background flex min-h-dvh">
      {/* Primeiro elemento focável da página: pula a navegação inteira. */}
      <a href="#conteudo-principal" className="skip-link">
        Pular para o conteúdo
      </a>

      <Sidebar />
      <MenuMobile />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <main
          id="conteudo-principal"
          // `tabIndex={-1}` permite que o "pular para o conteúdo" mova o foco
          // de fato para cá, e não apenas role a página.
          tabIndex={-1}
          className="flex-1 overflow-y-auto focus:outline-none"
        >
          {/* Largura total, sem `max-w`.
              O protótipo trava o conteúdo em 1280 px, mas isso é limitação da
              maquete: num painel de dados, cada pixel horizontal a mais cabe
              mais coluna de tabela e mais respiro nos gráficos. Faixa branca
              nas laterais de um monitor de trabalho é desperdício, não
              respiro. */}
          <div className="w-full space-y-6 px-4 py-6 sm:px-6 xl:px-8">
            {/* Só aparece a partir do segundo nível. Migalha de um item só é
                ruído: repete o que o título e a sidebar já dizem. */}
            {trilha.length > 1 && (
              <Breadcrumb
                items={trilha.map((item) => ({ label: item.label, to: item.to }))}
                className="mb-4"
              />
            )}

            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
