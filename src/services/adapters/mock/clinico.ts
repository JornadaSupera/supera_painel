import { attachmentError, safeAttachmentName } from "@/lib/attachments";
import { agendaClinica } from "@/mocks/agendaClinica";
import { alertasClinicos, type AlertaClinicoMock } from "@/mocks/alertasClinicos";
import { conversasClinicas, mensagensClinicas } from "@/mocks/conversasClinicas";
import { SEVERIDADE } from "@/lib/enums";
import type { CondutaAlerta, Severidade, StatusAlerta } from "@/lib/enums";
import { ERROR_CODE, fail, ok, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import type {
  AlertaClinico,
  AnexoMensagem,
  CompromissoAgenda,
  ConversaClinico,
  MensagemClinico,
} from "@/types/clinico";
import { now, simulate } from "./_helpers";

/**
 * Painel clínico — modo mock. Ver `mocks/agendaClinica.ts`,
 * `mocks/alertasClinicos.ts` e `mocks/conversasClinicas.ts`.
 */

export async function getMinhaAgenda(params: {
  de: string;
  ate: string;
}): Promise<ListResult<CompromissoAgenda>> {
  return simulate(() => {
    const de = new Date(params.de).getTime();
    const ate = new Date(params.ate).getTime();

    const linhas = agendaClinica
      .filter((compromisso) => {
        const inicio = new Date(compromisso.inicio).getTime();
        return inicio >= de && inicio < ate;
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio));

    return ok(linhas);
  });
}

/* -------------------------------------------------------------------------
   ALERTAS
   ------------------------------------------------------------------------- */

function severidadeDoGrau(grau: number): Severidade {
  if (grau >= 5) return SEVERIDADE.CRITICA;
  if (grau === 4) return SEVERIDADE.ALTA;
  if (grau >= 2) return SEVERIDADE.MEDIA;
  return SEVERIDADE.BAIXA;
}

const TOM_POR_STATUS_ALERTA: Record<StatusAlerta, AlertaClinico["status_tom"]> = {
  pendente: "danger",
  assumido: "warning",
  resolvido: "success",
};

function projetarAlerta(alerta: AlertaClinicoMock): AlertaClinico {
  return {
    id: alerta.id,
    paciente_id: alerta.paciente_id,
    paciente_nome: alerta.paciente_nome,
    sintoma_label: alerta.sintoma_label,
    grau: alerta.grau,
    severidade: severidadeDoGrau(alerta.grau),
    status: alerta.status,
    status_tom: TOM_POR_STATUS_ALERTA[alerta.status],
    conduta_tipo: alerta.conduta_tipo,
    conduta_notas: alerta.conduta_notas,
    criado_em: alerta.criado_em,
    assumido_em: alerta.assumido_em,
    resolvido_em: alerta.resolvido_em,
  };
}

export async function listAlertas(params?: {
  status?: StatusAlerta;
}): Promise<ListResult<AlertaClinico>> {
  return simulate(() => {
    const linhas = alertasClinicos
      .filter((alerta) => !params?.status || alerta.status === params.status)
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
      .map(projetarAlerta);

    return ok(linhas);
  });
}

export async function assumirAlerta(params: { id: string }): Promise<SingleResult<null>> {
  return simulate(() => {
    const alerta = alertasClinicos.find((item) => item.id === params.id);
    if (!alerta) return fail(ERROR_CODE.NOT_FOUND, "Alerta não encontrado.");
    if (alerta.status !== "pendente") {
      return fail(ERROR_CODE.CONFLICT, "Este alerta já foi assumido.");
    }

    alerta.status = "assumido";
    alerta.assumido_em = now();
    return okOne(null);
  });
}

export async function resolverAlerta(params: {
  id: string;
  conduta: CondutaAlerta;
  notas?: string;
}): Promise<SingleResult<null>> {
  return simulate(() => {
    const alerta = alertasClinicos.find((item) => item.id === params.id);
    if (!alerta) return fail(ERROR_CODE.NOT_FOUND, "Alerta não encontrado.");
    if (alerta.status !== "assumido") {
      return fail(ERROR_CODE.CONFLICT, "Só um alerta assumido pode ser resolvido.");
    }

    alerta.status = "resolvido";
    alerta.conduta_tipo = params.conduta;
    alerta.conduta_notas = params.notas?.trim() || null;
    alerta.resolvido_em = now();
    return okOne(null);
  });
}

/* -------------------------------------------------------------------------
   CHAT
   ------------------------------------------------------------------------- */

const TOM_POR_STATUS_CONVERSA: Record<"aberta" | "resolvida", ConversaClinico["status_tom"]> = {
  aberta: "info",
  resolvida: "success",
};

export async function listConversas(): Promise<ListResult<ConversaClinico>> {
  return simulate(() => {
    const linhas = conversasClinicas
      .slice()
      .sort((a, b) => b.ultima_mensagem_em.localeCompare(a.ultima_mensagem_em))
      .map<ConversaClinico>((conversa) => ({
        id: conversa.id,
        paciente_id: conversa.paciente_id,
        paciente_nome: conversa.paciente_nome,
        assunto_label: conversa.assunto_label,
        status: conversa.status,
        status_tom: TOM_POR_STATUS_CONVERSA[conversa.status],
        ultima_mensagem_em: conversa.ultima_mensagem_em,
        nao_lida_pela_equipe:
          !conversa.equipe_leu_em || conversa.equipe_leu_em < conversa.ultima_mensagem_em,
        atribuida: conversa.atribuida,
        especialidade_origem: conversa.especialidade_origem,
      }));

    return ok(linhas);
  });
}

export async function listMensagens(params: {
  conversaId: string;
}): Promise<ListResult<MensagemClinico>> {
  return simulate(() => {
    const linhas = mensagensClinicas
      .filter((mensagem) => mensagem.conversa_id === params.conversaId)
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
      .map<MensagemClinico>((mensagem) => ({
        id: mensagem.id,
        autor: mensagem.autor,
        corpo: mensagem.corpo,
        criado_em: mensagem.criado_em,
        anexos: mensagem.anexos ?? [],
      }));

    return ok(linhas);
  });
}

/** O conteúdo dos anexos enviados nesta sessão, por caminho. Some ao recarregar, como o resto do mock. */
const arquivosEnviados = new Map<string, Blob>();

export async function enviarMensagem(params: {
  conversaId: string;
  corpo: string;
  anexo?: File;
}): Promise<SingleResult<null>> {
  return simulate(() => {
    const conversa = conversasClinicas.find((item) => item.id === params.conversaId);
    if (!conversa) return fail(ERROR_CODE.NOT_FOUND, "Conversa não encontrada.");

    const corpo = params.corpo.trim();
    if (!corpo) return fail(ERROR_CODE.VALIDATION, "Escreva a mensagem antes de enviar.");

    // A mesma recusa do banco: só responde em conversa aberta.
    if (conversa.status !== "aberta") {
      return fail(
        ERROR_CODE.FORBIDDEN,
        "Esta conversa já foi encerrada ou não é da sua área: não dá para enviar mensagem nela.",
      );
    }

    if (params.anexo) {
      const motivo = attachmentError(params.anexo);
      if (motivo) return fail(ERROR_CODE.VALIDATION, motivo);
    }

    const id = crypto.randomUUID();
    const agora = now();
    const anexos: AnexoMensagem[] = [];

    if (params.anexo) {
      const caminho = `${id}/${safeAttachmentName(params.anexo.name, params.anexo.type)}`;
      arquivosEnviados.set(caminho, params.anexo);
      anexos.push({
        id: crypto.randomUUID(),
        caminho,
        nome: caminho.slice(caminho.indexOf("/") + 1),
        mime_type: params.anexo.type,
        tamanho: params.anexo.size,
      });
    }

    mensagensClinicas.push({
      id,
      conversa_id: conversa.id,
      autor: "profissional",
      corpo,
      criado_em: agora,
      anexos,
    });
    conversa.ultima_mensagem_em = agora;

    return okOne(null);
  });
}

export async function baixarAnexo(params: { caminho: string }): Promise<SingleResult<Blob>> {
  return simulate(() => {
    const arquivo = arquivosEnviados.get(params.caminho);
    if (!arquivo) return fail(ERROR_CODE.NOT_FOUND, "Não foi possível abrir este anexo.");
    return okOne(arquivo);
  });
}

export async function assumirConversa(params: { id: string }): Promise<SingleResult<null>> {
  return simulate(() => {
    const conversa = conversasClinicas.find((item) => item.id === params.id);
    if (!conversa) return fail(ERROR_CODE.NOT_FOUND, "Conversa não encontrada.");
    if (conversa.atribuida) return fail(ERROR_CODE.CONFLICT, "Esta conversa já está atribuída.");

    conversa.atribuida = true;
    // The mock has no session to read the claimer's specialty from; it uses
    // the one its sample conversations are routed to.
    conversa.especialidade_origem = "farmaceutico";
    return okOne(null);
  });
}

export async function resolverConversa(params: { id: string }): Promise<SingleResult<null>> {
  return simulate(() => {
    const conversa = conversasClinicas.find((item) => item.id === params.id);
    if (!conversa) return fail(ERROR_CODE.NOT_FOUND, "Conversa não encontrada.");
    if (conversa.status !== "aberta") return fail(ERROR_CODE.CONFLICT, "Esta conversa já está resolvida.");

    conversa.status = "resolvida";
    return okOne(null);
  });
}

export async function marcarConversaLida(params: { id: string }): Promise<SingleResult<null>> {
  return simulate(() => {
    const conversa = conversasClinicas.find((item) => item.id === params.id);
    if (!conversa) return fail(ERROR_CODE.NOT_FOUND, "Conversa não encontrada.");

    conversa.equipe_leu_em = now();
    return okOne(null);
  });
}
