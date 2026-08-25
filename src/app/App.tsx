import { AppRoutes } from "@/routes";
import { AppProviders } from "./providers";

/** Raiz da aplicação. */
export function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}

export default App;
