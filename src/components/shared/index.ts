/**
 * Componentes compartilhados — composições nossas sobre os primitivos do
 * shadcn/ui.
 *
 *   import { DataTable, StatCard, EmptyState } from "@/components/shared";
 *
 * Os primitivos ficam em `@/components/ui` e vêm do CLI do shadcn.
 * Nada aqui conhece domínio — nenhuma menção a "paciente" ou "protocolo".
 */

export { Can } from "./Can";
export type { CanProps } from "./Can";

export { BarChart, CHART_COLORS, DonutChart, LineChart } from "./Charts";
export type { DonutDatum, Serie } from "./Charts";

export { ChartCard } from "./ChartCard";
export type { ChartCardProps } from "./ChartCard";

export { ConfirmDialog } from "./ConfirmDialog";
export type { ConfirmDialogProps } from "./ConfirmDialog";

export { DataTable } from "./DataTable";
export type { Column, DataTableProps } from "./DataTable";

export { ModuloEmConstrucao } from "./ModuloEmConstrucao";
export type { ModuloEmConstrucaoProps } from "./ModuloEmConstrucao";

export { Breadcrumb, NivelBadge, PageHeader } from "./PageHeader";
export type { BreadcrumbItem, PageHeaderProps } from "./PageHeader";

export { Pagination } from "./Pagination";
export type { PaginationProps } from "./Pagination";

export { SearchInput } from "./SearchInput";

export { SkeletonCards, SkeletonChart, SkeletonForm, SkeletonTable } from "./Skeletons";

export { EmptyState, ErrorState, Loading } from "./StateBlock";
export type { ErrorLike } from "./StateBlock";

export { StatCard } from "./StatCard";
export type { StatCardProps } from "./StatCard";

export { StatusBadge } from "./StatusBadge";
export {
  TONE_ACAO_AUDITORIA,
  TONE_FASE,
  TONE_RISCO,
  TONE_SEVERIDADE,
  TONE_STATUS_CONTEUDO,
  TONE_STATUS_PACIENTE,
  TONE_STATUS_USUARIO,
} from "./status-tones";
export type { StatusTone } from "./StatusBadge";

export { AvatarGroup, UserAvatar } from "./UserAvatar";
export type { AvatarSize, Pessoa } from "./UserAvatar";
