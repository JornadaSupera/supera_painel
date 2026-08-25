import {
  Inbox,
  LoaderCircle,
  Lock,
  RotateCw,
  SearchX,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ERROR_CODE, type ApiError, type ErrorCode } from "@/services/contracts";

/**
 * State blocks: Empty, Error, Forbidden and Loading.
 *
 * They share the same silhouette on purpose — switching from one to another
 * does not shift the page. These are four of the five states every screen
 * must have (the fifth is Content).
 */

interface StateBlockProps {
  icon?: ReactNode;
  iconClassName?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  extra?: ReactNode;
  compact?: boolean;
  role?: "alert" | "status";
}

function StateBlock({
  icon,
  iconClassName,
  title,
  description,
  actions,
  extra,
  compact = false,
  role,
}: StateBlockProps) {
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 text-center",
        compact ? "min-h-40 py-8" : "min-h-70 py-12",
      )}
    >
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            "bg-muted text-muted-foreground flex size-13 items-center justify-center rounded-full",
            iconClassName,
          )}
        >
          {icon}
        </span>
      )}

      <div className="flex max-w-[44ch] flex-col gap-2">
        {title && <p className="text-base font-semibold">{title}</p>}
        {description && <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>}
      </div>

      {actions && <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>}
      {extra}
    </div>
  );
}

/* ------------------------------------------------------------------- empty */

export interface EmptyStateProps {
  /** `"search"` = filters are applied and nothing matched. The way out is to clear them. */
  variant?: "empty" | "search";
  title?: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  variant = "empty",
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  const isSearch = variant === "search";

  return (
    <StateBlock
      compact={compact}
      icon={isSearch ? <SearchX size={24} /> : <Inbox size={24} />}
      title={title ?? (isSearch ? "Nenhum resultado" : "Nada por aqui ainda")}
      description={
        description ??
        (isSearch
          ? "Nenhum registro corresponde aos filtros aplicados. Tente ampliar a busca."
          : "Quando houver registros, eles aparecerão nesta lista.")
      }
      actions={action}
    />
  );
}

/* ------------------------------------------------------------------- error */

interface ErrorCopy {
  icon: ReactNode;
  className?: string;
  title: string;
  description: string;
}

const ERROR_COPY: Partial<Record<ErrorCode, ErrorCopy>> = {
  NETWORK: {
    icon: <WifiOff size={24} />,
    title: "Sem conexão",
    description: "Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.",
  },
  FORBIDDEN: {
    icon: <Lock size={24} />,
    className: "bg-warning-bg text-warning",
    title: "Acesso não autorizado",
    description:
      "Seu perfil não tem permissão para ver este conteúdo. Fale com um administrador se precisar de acesso.",
  },
  UNAUTHORIZED: {
    icon: <Lock size={24} />,
    className: "bg-warning-bg text-warning",
    title: "Sessão expirada",
    description: "Por segurança, sua sessão foi encerrada. Entre novamente para continuar.",
  },
  NOT_FOUND: {
    icon: <SearchX size={24} />,
    title: "Registro não encontrado",
    description: "O item que você procura não existe mais ou foi removido.",
  },
  NOT_IMPLEMENTED: {
    icon: <TriangleAlert size={24} />,
    className: "bg-warning-bg text-warning",
    title: "Ainda não disponível",
    description: "Esta funcionalidade será entregue em uma fase seguinte do projeto.",
  },
};

const DEFAULT_ERROR_COPY: ErrorCopy = {
  icon: <TriangleAlert size={24} />,
  className: "bg-danger-bg text-danger",
  title: "Algo deu errado",
  description: "Não conseguimos carregar estas informações. Tente novamente em instantes.",
};

/** Tolerant error shape: accepts the contract exception or just `{ code }`. */
export type ErrorLike = Partial<ApiError> | (Error & { code?: ErrorCode; details?: unknown }) | null;

export interface ErrorStateProps {
  error?: ErrorLike;
  /** Shortcut for "forbidden", without having to fabricate an error. */
  variant?: "forbidden";
  onRetry?: () => void;
  title?: string;
  description?: string;
  compact?: boolean;
}

/** Codes where repeating the same request does not change the outcome. */
const NO_RETRY: ErrorCode[] = [
  ERROR_CODE.FORBIDDEN,
  ERROR_CODE.UNAUTHORIZED,
  ERROR_CODE.NOT_FOUND,
  ERROR_CODE.NOT_IMPLEMENTED,
];

export function ErrorState({
  error,
  variant,
  onRetry,
  title,
  description,
  compact = false,
}: ErrorStateProps) {
  const code: ErrorCode | undefined =
    variant === "forbidden" ? ERROR_CODE.FORBIDDEN : (error?.code as ErrorCode | undefined);

  const copy = (code && ERROR_COPY[code]) ?? DEFAULT_ERROR_COPY;
  const canRetry = Boolean(onRetry) && !(code && NO_RETRY.includes(code));
  const details = (error as { details?: unknown } | null)?.details;

  return (
    <StateBlock
      role="alert"
      compact={compact}
      icon={copy.icon}
      iconClassName={copy.className}
      title={title ?? copy.title}
      description={description ?? error?.message ?? copy.description}
      actions={
        canRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RotateCw />
            Tentar novamente
          </Button>
        )
      }
      extra={
        // The technical detail stays available for support, but closed by
        // default — the user should not be staring at a stack trace.
        import.meta.env.DEV && details ? (
          <details className="text-muted-foreground mt-2 font-mono text-[11px]">
            <summary className="cursor-pointer select-none">Detalhes técnicos</summary>
            <pre className="bg-muted mt-2 max-w-full overflow-x-auto rounded-sm p-3 text-left">
              {JSON.stringify(details, null, 2)}
            </pre>
          </details>
        ) : null
      }
    />
  );
}

/* ----------------------------------------------------------------- loading */

/**
 * Generic loading.
 *
 * Always prefer a Skeleton shaped like the content. This spinner is for when
 * there is no predictable shape.
 */
export function Loading({ message = "Carregando…", compact = false }) {
  return (
    <StateBlock
      role="status"
      compact={compact}
      icon={<LoaderCircle size={24} className="text-primary animate-spin" />}
      description={message}
    />
  );
}
