import { StatusBadge, TONE_AUDIT_ACTION, UserAvatar } from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ACAO_AUDITORIA_LABEL, ORIGEM_AUDITORIA_LABEL } from "@/lib/enums";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import type { AuditoriaListItem } from "@/types/auditoria";

/**
 * Um acesso, aberto.
 *
 * O escopo pede "detalhamento de acesso sensível" e o rastro de quem, quando,
 * de onde e o quê. A linha da tabela responde às três primeiras de forma
 * resumida; esta é a forma longa, com o identificador do registro alcançado —
 * que é o que permite amarrar a leitura a uma ficha específica numa apuração.
 *
 * > [!] Metadado, nunca conteúdo.
 * Não há nada aqui sobre o que foi lido. A trilha guarda que a ficha X foi
 * aberta por fulano às 14h, não o que estava escrito nela. Uma trilha que
 * copiasse o dado clínico dobraria a superfície de exposição em vez de
 * protegê-la — e passaria a exigir, ela própria, uma trilha.
 */

export interface DetalheAcessoProps {
  registro: AuditoriaListItem | null;
  carregando: boolean;
  aberto: boolean;
  onFechar: () => void;
  /** Motivo da ausência de IP, quando o backend não o registra. */
  semIp: string | null;
}

/** Uma linha do detalhe. `valor` nulo vira travessão, nunca campo em branco. */
function Campo({
  rotulo,
  valor,
  mono = false,
  ajuda,
}: {
  rotulo: string;
  valor: string | null;
  mono?: boolean;
  ajuda?: string;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3 py-2">
      <dt className="text-muted-foreground pt-0.5 text-xs">{rotulo}</dt>
      <dd className="min-w-0">
        <p
          className={
            valor === null
              ? "text-muted-foreground text-sm"
              : `text-foreground text-sm break-words ${mono ? "font-mono text-xs" : ""}`
          }
        >
          {valor ?? "—"}
        </p>
        {ajuda && <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">{ajuda}</p>}
      </dd>
    </div>
  );
}

export function DetalheAcesso({
  registro,
  carregando,
  aberto,
  onFechar,
  semIp,
}: DetalheAcessoProps) {
  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhe do acesso</DialogTitle>
          <DialogDescription>
            Registro imutável da trilha. Mostra o que foi alcançado, nunca o conteúdo lido.
          </DialogDescription>
        </DialogHeader>

        {carregando || !registro ? (
          <div className="flex flex-col gap-3 py-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <UserAvatar name={registro.usuario_nome} size="md" colorful className="shrink-0" />
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">
                  {registro.usuario_nome}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatDateTime(registro.criado_em)} · {relativeTime(registro.criado_em)}
                </p>
              </div>
              <StatusBadge
                tone={TONE_AUDIT_ACTION[registro.acao]}
                size="sm"
                dot
                className="ml-auto shrink-0"
              >
                {ACAO_AUDITORIA_LABEL[registro.acao]}
              </StatusBadge>
            </div>

            <dl className="divide-border divide-y border-t pt-1">
              <Campo rotulo="Recurso" valor={registro.recurso_label} />

              <Campo
                rotulo="Registro"
                valor={registro.recurso_id}
                mono
                ajuda={
                  registro.recurso_id
                    ? undefined
                    : "Leitura de lista: alcançou vários registros, não um específico."
                }
              />

              <Campo
                rotulo="Paciente"
                valor={registro.paciente_nome}
                ajuda={
                  registro.paciente_nome ? undefined : "O acesso não é sobre um paciente específico."
                }
              />

              <Campo
                rotulo="Linhas"
                valor={registro.linhas === null ? null : formatNumber(registro.linhas)}
                // É a diferença entre abrir uma ficha e varrer a base — a única
                // pergunta que distingue consulta de rotina de extração em massa.
                ajuda={
                  registro.linhas !== null && registro.linhas > 1
                    ? "Quantos registros a operação alcançou de uma vez."
                    : undefined
                }
              />

              <Campo rotulo="Origem" valor={ORIGEM_AUDITORIA_LABEL[registro.origem]} />

              <Campo
                rotulo="Endereço"
                valor={registro.ip}
                mono={Boolean(registro.ip)}
                ajuda={registro.ip ? undefined : (semIp ?? undefined)}
              />
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DetalheAcesso;
