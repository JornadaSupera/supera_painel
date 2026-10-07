import { FileText, FileType2, Video, type LucideIcon } from "lucide-react";

import type { TipoConteudo } from "@/lib/enums";

/** One icon per format of the library, wherever an orientation is listed. */
export const CONTENT_KIND_ICON: Record<TipoConteudo, LucideIcon> = {
  artigo: FileText,
  video: Video,
  pdf: FileType2,
};
