import { Info, MailX, Unlink } from "lucide-react";

import { Can, DetailField } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import { STATUS_CONVITE_LABEL, type PacienteDetalhe } from "@/types/paciente";
import { isBelowAppMinimumAge, UNDERAGE_INVITE_REASON } from "../appAccess";
import { useCancelarConvite } from "../hooks/usePacientes";

/**
 * Where the patient stands with the app: the invitation, the last access, and
 * the two acts that undo a mistake — cancelling an invitation still open, and
 * unlinking the account that accepted it.
 *
 * The two acts sit beside the data they act on, not in the header: there they
 * would compete with "emitir convite", which is the normal path, and these are
 * the correction of a slip. Unlinking asks for confirmation, so the dialog stays
 * with the page and this block only asks for it.
 */
export function AppAccessDetails({
  paciente,
  onUnlink,
  unlinking,
}: {
  paciente: PacienteDetalhe;
  onUnlink: () => void;
  unlinking: boolean;
}) {
  const cancelInvitation = useCancelarConvite();

  return (
    <>
      <dl className="grid grid-cols-2 gap-4">
        <DetailField rotulo="Convite">{STATUS_CONVITE_LABEL[paciente.convite_status]}</DetailField>

        <DetailField rotulo="Enviado em">
          <span className="tabular-nums">{formatDateTime(paciente.convite_enviado_em)}</span>
        </DetailField>

        <DetailField rotulo="Último acesso">
          {/* "Sem registro", not "never": the database does not expose the
              patient's last sign-in yet, so an empty value means unknown. */}
          {paciente.ultimo_acesso_app_em ? relativeTime(paciente.ultimo_acesso_app_em) : "Sem registro"}
        </DetailField>

        <DetailField rotulo="Cadastrado em">
          <span className="tabular-nums">{formatDate(paciente.criado_em)}</span>
        </DetailField>
      </dl>

      {/* Why "Emitir convite" is off for this record, in writing: the header
          only says it on hover. A record already linked keeps its link. */}
      {paciente.convite_status !== "aceito" && isBelowAppMinimumAge(paciente.nascimento) && (
        <p className="text-muted-foreground flex gap-2 text-xs">
          <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          {UNDERAGE_INVITE_REASON}
        </p>
      )}

      <Can permission={PERMISSAO.PACIENTES_INVITE}>
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {paciente.convite_status === "enviado" && (
            <Button
              variant="outline"
              size="sm"
              disabled={cancelInvitation.isPending}
              onClick={() => cancelInvitation.mutate(paciente.id)}
            >
              <MailX />
              Cancelar convite
            </Button>
          )}

          {paciente.convite_status === "aceito" && (
            <Button
              variant="outline"
              size="sm"
              disabled={unlinking}
              onClick={onUnlink}
              className="text-destructive hover:text-destructive"
            >
              <Unlink />
              Desfazer vínculo com a conta
            </Button>
          )}
        </div>
      </Can>
    </>
  );
}

export default AppAccessDetails;
