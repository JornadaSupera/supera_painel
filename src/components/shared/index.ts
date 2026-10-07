/**
 * Shared components — our own compositions on top of the shadcn/ui primitives.
 *
 *   import { DataTable, StatCard, EmptyState } from "@/components/shared";
 *
 * The primitives live in `@/components/ui` and come from the shadcn CLI.
 * Nothing here knows about the domain — no mention of "patient" or "protocol".
 */

export { BackendPendente } from "./BackendPendente";
export type { BackendPendenteProps } from "./BackendPendente";

export { CatalogFilterSelect } from "./CatalogFilterSelect";

export { Can } from "./Can";

export { DateInput, TimeInput } from "./DateTimeFields";
export { DetailCard, DetailField, DetailRow, DetailSection, SectionHeading } from "./DetailBlocks";
export type { CanProps } from "./Can";

export { BarChart, CHART_COLORS, DonutChart, LineChart } from "./Charts";
export type { DonutDatum, Series } from "./Charts";

export { ChartCard } from "./ChartCard";
export type { ChartCardProps } from "./ChartCard";

export { ConfirmDialog } from "./ConfirmDialog";
export type { ConfirmDialogProps } from "./ConfirmDialog";

export { DataTable } from "./DataTable";

export { DecisionList } from "./DecisionList";
export type { Decision } from "./DecisionList";
export type { Column, DataTableProps } from "./DataTable";

export { ClearFiltersButton, FilterSelect } from "./FilterBar";

export { FilterChip, FilterChipGroup } from "./FilterChips";

export { FilterPanel } from "./FilterPanel";
export type { FilterPanelProps } from "./FilterPanel";

export { Footnote } from "./Footnote";

export { Logo } from "./Logo";

export { MarkdownEditor } from "./MarkdownEditor";
export { MarkdownText } from "./MarkdownText";
export type { LogoProps } from "./Logo";
export type { FilterSelectProps } from "./FilterBar";

export { FormSection } from "./FormSection";

export { FormSelect } from "./FormSelect";
export type { FormSelectProps } from "./FormSelect";

export { UnderConstruction } from "./UnderConstruction";
export type { UnderConstructionProps } from "./UnderConstruction";

export { Breadcrumb, PageHeader } from "./PageHeader";
export type { BreadcrumbItem, PageHeaderProps } from "./PageHeader";

export { Pagination } from "./Pagination";
export type { PaginationProps } from "./Pagination";

export { ScrollableTabsList } from "./ScrollableTabsList";

export { SearchInput } from "./SearchInput";

export { BotaoExportarCaptura } from "./BotaoExportarCaptura";
export { SkeletonCards, SkeletonChart, SkeletonForm, SkeletonRows, SkeletonTable } from "./Skeletons";

export { SpecialtySeal } from "./SpecialtySeal";

export { SourceErrorAlert, SourceErrorChip } from "./SourceError";
export type { SourceErrorProps } from "./SourceError";

export { EmptyState, ErrorState, Loading } from "./StateBlock";
export type { ErrorLike } from "./StateBlock";

export { StatCard } from "./StatCard";
export type { StatCardProps } from "./StatCard";

export { StatusBadge } from "./StatusBadge";
export {
  TONE_AUDIT_ACTION,
  TONE_CONTENT_STATUS,
  TONE_PATIENT_STATUS,
  TONE_PHASE,
  TONE_RISK,
  TONE_SEVERITY,
  TONE_USER_STATUS,
} from "./status-tones";
export type { StatusTone } from "./StatusBadge";

export { AvatarGroup, UserAvatar } from "./UserAvatar";
export type { AvatarSize, Person } from "./UserAvatar";
