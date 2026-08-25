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
 * Blocos de estado: Vazio, Erro, Sem permissão e Carregando.
 *
 * Compartilham a mesma silhueta de propósito — trocar de um para outro não
 * desloca a página. São quatro dos cinco estados obrigatórios de toda tela
 * (o quinto é o Conteúdo).
 */

interface StateBlockProps {
  icone?: ReactNode;
  iconeClasse?: string;
  titulo?: string;
  descricao?: string;
  acoes?: ReactNode;
  extra?: ReactNode;
  compacto?: boolean;
  role?: "alert" | "status";
}

function StateBlock({
  icone,
  iconeClasse,
  titulo,
  descricao,
  acoes,
  extra,
  compacto = false,
  role,
}: StateBlockProps) {
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 text-center",
        compacto ? "min-h-40 py-8" : "min-h-70 py-12",
      )}
    >
      {icone && (
        <span
          aria-hidden="true"
          className={cn(
            "bg-muted text-muted-foreground flex size-13 items-center justify-center rounded-full",
            iconeClasse,
          )}
        >
          {icone}
        </span>
      )}

      <div className="flex max-w-[44ch] flex-col gap-2">
        {titulo && <p className="text-base font-semibold">{titulo}</p>}
        {descricao && <p className="text-muted-foreground text-sm leading-relaxed">{descricao}</p>}
      </div>

      {acoes && <div className="flex flex-wrap items-center justify-center gap-3">{acoes}</div>}
      {extra}
    </div>
  );
}

/* ------------------------------------------------------------------- vazio */

export interface EmptyStateProps {
  /** `"busca"` = há filtros aplicados e nada casou. A saída é limpar filtros. */
  variant?: "vazio" | "busca";
  titulo?: string;
  descricao?: string;
  action?: ReactNode;
  compacto?: boolean;
}

export function EmptyState({
  variant = "vazio",
  titulo,
  descricao,
  action,
  compacto = false,
}: EmptyStateProps) {
  const ehBusca = variant === "busca";

  return (
    <StateBlock
      compacto={compacto}
      icone={ehBusca ? <SearchX size={24} /> : <Inbox size={24} />}
      titulo={titulo ?? (ehBusca ? "Nenhum resultado" : "Nada por aqui ainda")}
      descricao={
        descricao ??
        (ehBusca
          ? "Nenhum registro corresponde aos filtros aplicados. Tente ampliar a busca."
          : "Quando houver registros, eles aparecerão nesta lista.")
      }
      acoes={action}
    />
  );
}

/* -------------------------------------------------------------------- erro */

interface CopyErro {
  icone: ReactNode;
  classe?: string;
  titulo: string;
  descricao: string;
}

const COPY_ERRO: Partial<Record<ErrorCode, CopyErro>> = {
  NETWORK: {
    icone: <WifiOff size={24} />,
    titulo: "Sem conexão",
    descricao: "Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.",
  },
  FORBIDDEN: {
    icone: <Lock size={24} />,
    classe: "bg-warning-bg text-warning",
    titulo: "Acesso não autorizado",
    descricao:
      "Seu perfil não tem permissão para ver este conteúdo. Fale com um administrador se precisar de acesso.",
  },
  UNAUTHORIZED: {
    icone: <Lock size={24} />,
    classe: "bg-warning-bg text-warning",
    titulo: "Sessão expirada",
    descricao: "Por segurança, sua sessão foi encerrada. Entre novamente para continuar.",
  },
  NOT_FOUND: {
    icone: <SearchX size={24} />,
    titulo: "Registro não encontrado",
    descricao: "O item que você procura não existe mais ou foi removido.",
  },
  NOT_IMPLEMENTED: {
    icone: <TriangleAlert size={24} />,
    classe: "bg-warning-bg text-warning",
    titulo: "Ainda não disponível",
    descricao: "Esta funcionalidade será entregue em uma fase seguinte do projeto.",
  },
};

const COPY_ERRO_PADRAO: CopyErro = {
  icone: <TriangleAlert size={24} />,
  classe: "bg-danger-bg text-danger",
  titulo: "Algo deu errado",
  descricao: "Não conseguimos carregar estas informações. Tente novamente em instantes.",
};

/** Erro em formato tolerante: aceita a exceção do contrato ou só `{ code }`. */
export type ErrorLike = Partial<ApiError> | (Error & { code?: ErrorCode; details?: unknown }) | null;

export interface ErrorStateProps {
  error?: ErrorLike;
  /** Atalho para "sem permissão", sem precisar fabricar um erro. */
  variant?: "forbidden";
  onRetry?: () => void;
  titulo?: string;
  descricao?: string;
  compacto?: boolean;
}

/** Códigos em que repetir a mesma requisição não muda o resultado. */
const SEM_RETRY: ErrorCode[] = [
  ERROR_CODE.FORBIDDEN,
  ERROR_CODE.UNAUTHORIZED,
  ERROR_CODE.NOT_FOUND,
  ERROR_CODE.NOT_IMPLEMENTED,
];

export function ErrorState({
  error,
  variant,
  onRetry,
  titulo,
  descricao,
  compacto = false,
}: ErrorStateProps) {
  const codigo: ErrorCode | undefined =
    variant === "forbidden" ? ERROR_CODE.FORBIDDEN : (error?.code as ErrorCode | undefined);

  const copy = (codigo && COPY_ERRO[codigo]) ?? COPY_ERRO_PADRAO;
  const podeRetentar = Boolean(onRetry) && !(codigo && SEM_RETRY.includes(codigo));
  const detalhes = (error as { details?: unknown } | null)?.details;

  return (
    <StateBlock
      role="alert"
      compacto={compacto}
      icone={copy.icone}
      iconeClasse={copy.classe}
      titulo={titulo ?? copy.titulo}
      descricao={descricao ?? error?.message ?? copy.descricao}
      acoes={
        podeRetentar && (
          <Button variant="outline" onClick={onRetry}>
            <RotateCw />
            Tentar novamente
          </Button>
        )
      }
      extra={
        // Detalhe técnico fica disponível para o suporte, mas fechado por
        // padrão — o usuário não deve encarar stack trace.
        import.meta.env.DEV && detalhes ? (
          <details className="text-muted-foreground mt-2 font-mono text-[11px]">
            <summary className="cursor-pointer select-none">Detalhes técnicos</summary>
            <pre className="bg-muted mt-2 max-w-full overflow-x-auto rounded-sm p-3 text-left">
              {JSON.stringify(detalhes, null, 2)}
            </pre>
          </details>
        ) : null
      }
    />
  );
}

/* ---------------------------------------------------------------- carregando */

/**
 * Carregamento genérico.
 *
 * Preferir sempre um Skeleton com a forma do conteúdo. Este spinner é para
 * quando não há forma previsível.
 */
export function Loading({ mensagem = "Carregando…", compacto = false }) {
  return (
    <StateBlock
      role="status"
      compacto={compacto}
      icone={<LoaderCircle size={24} className="text-primary animate-spin" />}
      descricao={mensagem}
    />
  );
}
