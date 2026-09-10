import { ERROR_CODE, fail, type ListResult, type SingleResult } from "@/services/contracts";
import type {
  EstatisticasOperacionais,
  IndicadorOperacional,
  LinhaEspecialidade,
  PontoVolume,
} from "@/types/estatisticas";

/**
 * Estatísticas operacionais — a operação da clínica.
 *
 * A tela responde: quanto se atende, com que rapidez se responde no chat, onde
 * está o gargalo. **Hoje o painel não consegue medir nada disso, e passou a
 * dizer isso em vez de estampar zero.**
 *
 * > [!] O que aconteceu aqui
 * Esta versão lia `.from("appointments")` e `.from("messages")` diretamente. As
 * políticas que atendem o administrador nessas tabelas
 * (`appointments_select_admin`, `messages_select_via_conversation_reader`) estão
 * declaradas `TO clinical_reader`, e `authenticated` **não é membro desse
 * papel** — quem as alcança são as funções `read_*`, que têm `clinical_reader`
 * como dono.
 *
 * O efeito não era erro: era **zero linhas em silêncio**. A tela então dividia,
 * somava e publicava "0 atendimentos por semana", "0 mensagens por dia" com a
 * mesma aparência de um número medido. Uma tela que se cala por falta de dado é
 * um inconveniente; uma que afirma um fato falso é outra coisa.
 *
 * > [!] O que existe de saída, e o que não existe
 * | Indicador | Origem possível hoje |
 * |---|---|
 * | Volume de conversas por área | ✅ `read_conversations(null)` — leitura global, teto 200 |
 * | Conversas em aberto | ✅ mesma função |
 * | Tempo de resposta no chat | ⚠️ exigiria `read_messages` **por conversa** — 200 chamadas, cada uma gravando acesso a conteúdo clínico na trilha |
 * | Atendimentos, adesão à agenda, ocupação | ❌ não há leitura de agenda da clínica inteira |
 * | Meta mensal e capacidade | ❌ não há tabela de parâmetro operacional |
 * | Fila de alertas | ❌ não existe alerta no backend |
 *
 * A parte de conversas será religada sobre `read_conversations` numa entrega
 * própria. Até lá a tela não inventa: declara a ausência com o motivo.
 *
 * > [!] Por especialidade, nunca por profissional
 * Decisão que sobrevive à mudança de origem. Ranquear pessoa por volume ou por
 * tempo de resposta transformaria um painel de operação em avaliação individual
 * de desempenho — que não é o que foi contratado, e cujo efeito prático seria a
 * equipe otimizar o número em vez do atendimento.
 */

/** O motivo, escrito para quem opera o painel — a regra, não o arquivo. */
export const SEM_ORIGEM_OPERACIONAL =
  "Os indicadores de operação saem da agenda e do chat da clínica inteira, e o backend não oferece essa leitura em conjunto: a agenda só se lê paciente a paciente e a conversa uma a uma. Falta uma leitura agregada, que devolva as contagens já somadas. Enquanto ela não existe, o painel prefere não exibir número a exibir um número que não mediu.";

/** O motivo da fila de alertas, que é outra ausência — a de alerta nenhum. */
export const SEM_ORIGEM_ALERTAS =
  "Não existe fila de alertas no backend: não há tabela de alerta, regra de criticidade nem registro de conduta. Derivar 'sintoma crítico' a partir do grau seria inferência clínica feita pelo painel, que o escopo não permite — quem define o que é grave é a equipe assistencial.";

export async function getIndicadores(): Promise<SingleResult<EstatisticasOperacionais>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, SEM_ORIGEM_OPERACIONAL);
}

/* -------------------------------------------------------------------------
   RECORTES DA MESMA LEITURA
   -------------------------------------------------------------------------
   As três operações abaixo existem no contrato como perguntas separadas e
   respondem da mesma origem. Compartilham a ausência dela: quando a leitura
   agregada existir, elas voltam juntas, sem que a tela mude.
   ------------------------------------------------------------------------- */

export async function getTempoResposta(): Promise<SingleResult<IndicadorOperacional>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, SEM_ORIGEM_OPERACIONAL);
}

export async function getAdesaoAgenda(): Promise<ListResult<LinhaEspecialidade>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, SEM_ORIGEM_OPERACIONAL);
}

export async function getGargalos(): Promise<ListResult<PontoVolume>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, SEM_ORIGEM_OPERACIONAL);
}

/**
 * Fila de alertas.
 *
 * Devolvia lista vazia, o que a tela mostrava como "nenhum alerta" — afirmação
 * tranquilizadora e falsa: não há alerta nenhum porque o backend não produz
 * alerta, não porque a clínica esteja sem ocorrência.
 */
export async function getFilaAlertas(): Promise<ListResult<never>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, SEM_ORIGEM_ALERTAS);
}
