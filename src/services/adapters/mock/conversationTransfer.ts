import { STATUS_USUARIO, PAPEL } from "@/lib/enums";
import { atribuicoesClinicas, conversasClinicas, mensagensClinicas } from "@/mocks/conversasClinicas";
import { usuarios } from "@/mocks/usuarios";
import { ERROR_CODE, fail, ok, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import type { ConversationAssignment, TransferTarget } from "@/types/conversation-transfer";
import { autorDaSessao } from "./auth";
import { now, simulate } from "./_helpers";

/**
 * Handing a conversation to a colleague — mock mode.
 *
 * Reproduces what the database does in one step: the destination's area becomes
 * the conversation's, the current assignment closes, a new one opens, and a
 * generic message tells the patient — without naming the person or the area.
 */

export async function listTransferTargets(): Promise<ListResult<TransferTarget>> {
  return simulate(() => {
    const me = autorDaSessao();

    return ok(
      usuarios
        .filter(
          (usuario) =>
            usuario.papel === PAPEL.PROFISSIONAL &&
            usuario.status === STATUS_USUARIO.ATIVO &&
            usuario.especialidade !== null &&
            usuario.id !== me?.id,
        )
        .map<TransferTarget>((usuario) => ({
          professional_id: usuario.id,
          name: usuario.nome,
          specialties: usuario.especialidade ? [usuario.especialidade] : [],
          changed_area: false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    );
  });
}

export async function transferConversation(params: {
  conversationId: string;
  toProfessionalId: string;
}): Promise<SingleResult<null>> {
  return simulate(() => {
    const conversa = conversasClinicas.find((item) => item.id === params.conversationId);
    if (!conversa) return fail(ERROR_CODE.NOT_FOUND, "Conversa não encontrada.");

    const destino = usuarios.find((usuario) => usuario.id === params.toProfessionalId);
    const me = autorDaSessao();

    // The same refusal as the database: open, in the caller's area, and a
    // destination that is active and works in some area.
    if (
      conversa.status !== "aberta" ||
      conversa.especialidade_origem === null ||
      conversa.especialidade_origem !== me?.especialidade ||
      !destino ||
      destino.status !== STATUS_USUARIO.ATIVO ||
      destino.especialidade === null
    ) {
      return fail(
        ERROR_CODE.FORBIDDEN,
        "Não foi possível encaminhar: a conversa precisa estar aberta e na sua área, e o colega precisa estar ativo e ter uma área de atuação.",
      );
    }

    const agora = now();
    for (const atribuicao of atribuicoesClinicas) {
      if (atribuicao.conversa_id === conversa.id && atribuicao.liberada_em === null) {
        atribuicao.liberada_em = agora;
      }
    }
    atribuicoesClinicas.push({
      id: crypto.randomUUID(),
      conversa_id: conversa.id,
      profissional_id: destino.id,
      profissional_nome: destino.nome,
      especialidade: destino.especialidade,
      atribuida_em: agora,
      liberada_em: null,
    });

    conversa.especialidade_origem = destino.especialidade;
    conversa.ultima_mensagem_em = agora;
    mensagensClinicas.push({
      id: crypto.randomUUID(),
      conversa_id: conversa.id,
      autor: "sistema",
      corpo: "Sua conversa foi encaminhada para outro profissional da equipe.",
      criado_em: agora,
    });

    return okOne(null);
  });
}

export async function listConversationAssignments(params: {
  conversationId: string;
}): Promise<ListResult<ConversationAssignment>> {
  return simulate(() =>
    ok(
      atribuicoesClinicas
        .filter((atribuicao) => atribuicao.conversa_id === params.conversationId)
        .sort((a, b) => a.atribuida_em.localeCompare(b.atribuida_em))
        .map<ConversationAssignment>((atribuicao) => ({
          id: atribuicao.id,
          professional_id: atribuicao.profissional_id,
          professional_name: atribuicao.profissional_nome,
          specialty: atribuicao.especialidade,
          assigned_at: atribuicao.atribuida_em,
          released_at: atribuicao.liberada_em,
        })),
    ),
  );
}
