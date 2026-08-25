import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/app/App";
import { assertEnv } from "@/lib/env";
import { observarTemaDoSistema } from "@/stores/theme";
import "@/styles/global.css";

// Falha alto e cedo: configuração errada não pode virar bug silencioso no meio
// de uma tela clínica.
assertEnv();

// Mantém o tema `system` acompanhando a preferência do SO.
observarTemaDoSistema();

const root = document.getElementById("root");
if (!root) throw new Error('Elemento #root não encontrado em index.html.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
