import { Ban, Ellipsis, FileText, MessageSquareShare, SquarePen } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Can, ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_PACIENTE } from "@/lib/enums";
import { PERMISSAO } from "@/lib/rbac";
import type { PacienteListItem } from "@/types/paciente";
import { useDesativarPaciente, useEnviarConvite } from "../hooks/usePacientes";

/**
 * Menu de ações de uma linha da listagem.
 *
 * Cada item é envolvido por `<Can>`: quem não pode escrever vê só "Ver ficha".
 * A rota e o adapter também checam — esconder o item evita o erro honesto, não
 * o mal-intencionado.
 */
export function AcoesPaciente({ paciente }: { paciente: PacienteListItem }) {
  const navigate = useNavigate();
  const [confirmando, setConfirmando] = useState(false);

  const desativar = useDesativarPaciente();
  const convite = useEnviarConvite();

  const inativo = paciente.status === STATUS_PACIENTE.INATIVO;

  return (
    // O clique no menu não deve abrir a ficha — a linha inteira é clicável.
    <div onClick={(evento) => evento.stopPropagation()} role="presentation">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Ações de ${paciente.nome}`}
            className="text-muted-foreground"
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => navigate(`/pacientes/${paciente.id}`)}>
            <FileText />
            Ver ficha
          </DropdownMenuItem>

          <Can permission={PERMISSAO.PACIENTES_WRITE}>
            <DropdownMenuItem
              disabled={inativo}
              onSelect={() => navigate(`/pacientes/${paciente.id}?editar=1`)}
            >
              <SquarePen />
              Editar cadastro
            </DropdownMenuItem>

            <DropdownMenuItem
              disabled={inativo || convite.isPending}
              onSelect={() => convite.mutate(paciente.id)}
            >
              <MessageSquareShare />
              {paciente.convite_status === "nao_enviado" ? "Enviar convite" : "Reenviar convite"}
            </DropdownMenuItem>
          </Can>

          <Can permission={PERMISSAO.PACIENTES_DEACTIVATE}>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={inativo}
              onSelect={() => setConfirmando(true)}
            >
              <Ban />
              Desativar paciente
            </DropdownMenuItem>
          </Can>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        title={`Desativar ${paciente.nome}?`}
        description="A ficha continua no sistema e o histórico é preservado, mas o paciente deixa de aparecer como ativo e perde o acesso ao aplicativo."
        confirmLabel="Desativar"
        requireReason
        loading={desativar.isPending}
        onConfirm={({ reason }) => {
          desativar.mutate({ id: paciente.id, motivo: reason });
          setConfirmando(false);
        }}
      />
    </div>
  );
}

export default AcoesPaciente;
