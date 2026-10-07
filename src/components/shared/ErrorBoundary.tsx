import { RotateCw } from "lucide-react";
import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "./StateBlock";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** A new value clears the error — the address, so leaving the broken screen recovers. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Catches a screen that fails while rendering, so it shows an error instead of
 * taking the whole panel down.
 *
 * Without one, React unmounts the entire tree on an uncaught error: the panel
 * went blank, sidebar included, and only F5 brought it back.
 *
 * The way out is reloading the page. A screen whose code failed to load stays
 * failed in React's cache, so trying again in place would fail the same way.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <ErrorState
        title="Esta tela não abriu"
        description="Algo falhou ao montar a tela. Recarregue a página para abri-la de novo: o que já foi salvo continua salvo."
        actions={
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RotateCw />
            Recarregar a página
          </Button>
        }
      />
    );
  }
}

export default ErrorBoundary;
