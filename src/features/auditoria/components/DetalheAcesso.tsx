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
}

/**
 * O que dizer quando não há endereço.
 *
 * Não é falha de coleta: a trilha só enxerga o endereço quando a chamada chega
 * pela web. Rotina agendada, gatilho interno e acesso técnico direto ao banco
 * não têm um — e registro anterior à coluna existir também não. Campo em
 * branco sem explicação faz quem apura suspeitar de perda de dado.
 */
const SEM_ENDERECO =
  "Sem endereço: a chamada não veio pela web, ou é anterior à trilha passar a registrá-lo.";

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

export function DetalheAcesso({ registro, carregando, aberto, onFechar }: DetalheAcessoProps) {
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

              {/* A ausência olha o ID, não o nome. Um acesso COM paciente cujo
                  nome não resolvemos não é um acesso sem paciente — dizer que é
                  inverteria a conclusão de quem apura. */}
              <Campo
                rotulo="Paciente"
                valor={registro.paciente_nome}
                ajuda={
                  registro.paciente_id
                    ? undefined
                    : "O acesso não é sobre um paciente específico."
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

              <Campo
                rotulo="Origem"
                valor={ORIGEM_AUDITORIA_LABEL[registro.origem]}
                ajuda="Em que qualidade a pessoa agiu — não o aplicativo que usou."
              />

              <Campo
                rotulo="Endereço"
                valor={registro.ip}
                mono={Boolean(registro.ip)}
                // É indício operacional, não prova: quem controla o cliente
                // pode declarar o começo da cadeia de encaminhamento.
                ajuda={
                  registro.ip
                    ? "Indício de procedência, não prova de autoria."
                    : SEM_ENDERECO
                }
              />

              <Campo
                rotulo="Sigilo"
                valor={
                  registro.material_restrito
                    ? "Material sob sigilo profissional"
                    : "Sem marca de sigilo"
                }
                ajuda={
                  registro.material_restrito
                    ? "A trilha registra QUE houve o acesso. De quem e a qual sessão, não — isso faria do próprio log a indiscrição que ele denuncia."
                    : undefined
                }
              />
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DetalheAcesso;
