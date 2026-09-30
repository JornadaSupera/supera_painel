import { Download, FileImage, FileText, LoaderCircle } from "lucide-react";
import { useState, type RefObject } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { audit } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { timestamp, exportPdf, exportPng } from "@/lib/pdf";

/**
 * Exportação da captura de uma tela, em PDF ou imagem.
 *
 * Serve ao Dashboard (MVP §5) e às Estatísticas clínicas (Médio §6, "exportação
 * para apresentações, congressos e auditorias"): o que muda de uma tela para a
 * outra é o que se captura e como a exportação é declarada à trilha, e os dois
 * entram por parâmetro.
 *
 * O rodapé do arquivo carrega **quem** exportou e **quando** — um PDF de dados
 * clínicos que circula sem procedência é um problema de rastreabilidade. E a
 * ação em si vai para a trilha de auditoria.
 */
export function BotaoExportarCaptura({
  alvo,
  nomeBase,
  recurso,
  onExportado,
}: {
  alvo: RefObject<HTMLElement | null>;
  nomeBase: string;
  /** Nome da tela na trilha do cliente (`lib/audit`). */
  recurso: string;
  /** Chamado depois que o arquivo saiu, para a tela declarar a exportação ao banco. */
  onExportado: (formato: "pdf" | "png") => void;
}) {
  const { user } = useAuth();
  const [exportando, setExportando] = useState<"pdf" | "png" | null>(null);

  const exportar = async (formato: "pdf" | "png") => {
    const elemento = alvo.current;
    if (!elemento) return;

    setExportando(formato);

    const nome = `${nomeBase}_${timestamp()}`;
    const rodape = user
      ? `Jornada Supera · exportado por ${user.nome} em ${formatDateTime(new Date().toISOString())}`
      : undefined;

    try {
      if (formato === "pdf") {
        await exportPdf({ element: elemento, name: nome, footer: rodape });
      } else {
        await exportPng({ element: elemento, name: nome });
      }

      audit.export(recurso, { formato, arquivo: nome });
      // O arquivo já saiu: a trilha do banco é avisada em segundo plano.
      onExportado(formato);
      toast.success(`Captura exportada em ${formato.toUpperCase()}`);
    } catch {
      toast.error("Não foi possível exportar", {
        description: "Tente novamente. Se persistir, avise o suporte.",
      });
    } finally {
      setExportando(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* `no-print` mantém o próprio botão fora da captura. */}
        <Button variant="outline" disabled={exportando !== null} className="no-print">
          {exportando ? <LoaderCircle className="animate-spin" /> : <Download />}
          Exportar
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Captura do painel</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void exportar("pdf")}>
          <FileText />
          PDF (A4 paisagem)
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => void exportar("png")}>
          <FileImage />
          Imagem PNG
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <p className="text-muted-foreground px-2 py-1.5 text-xs leading-relaxed">
          A exportação é registrada na trilha de auditoria.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default BotaoExportarCaptura;
