import {
  ESPECIALIDADE_LABEL,
  FASE_TRATAMENTO_LABEL,
  toOptions,
  type FaseTratamento,
} from "@/lib/enums";
import { cids } from "@/mocks/cids";
import { efeitosAdversos, protocolos } from "@/mocks/protocolos";
import { ok, type ListResult } from "@/services/contracts";
import type { Cid, EfeitoAdverso, Protocolo } from "@/types/catalogo";
import { simulate } from "./_helpers";

/**
 * Catálogos de apoio — CID-10, protocolos, especialidades e efeitos adversos.
 *
 * São listas curtas e estáveis: vêm inteiras, sem paginação, e as telas as
 * mantêm em cache longo (ver `staleTime` nos hooks). Paginar um <Select> de 15
 * itens só adicionaria estado sem melhorar nada.
 */

export async function listCids(): Promise<ListResult<Cid>> {
  return simulate(() => ok(cids));
}

export async function listProtocolos(): Promise<ListResult<Protocolo>> {
  return simulate(() => ok(protocolos.filter((protocolo) => protocolo.ativo)));
}

/**
 * As 7 especialidades da equipe multidisciplinar.
 *
 * Sai da camada de dados, e não de `lib/enums` direto na tela, porque na Fase
 * 15 a lista passa a ser uma tabela — a clínica pode querer desativar uma
 * especialidade sem que isso vire deploy.
 */
export async function listEspecialidades(): Promise<ListResult<{ value: string; label: string }>> {
  return simulate(() => ok(toOptions(ESPECIALIDADE_LABEL)));
}

export async function listEfeitos(): Promise<ListResult<EfeitoAdverso>> {
  return simulate(() => ok(efeitosAdversos));
}

/**
 * As fases que o cadastro reconhece.
 *
 * O mock devolve as cinco do protótipo — é a base fictícia, e nela todas
 * existem. No Supabase a lista é a tabela `treatment_phases`, que costuma ser
 * menor; é justamente por isso que o seletor pergunta à camada de dados em vez
 * de ler o enum direto.
 */
export async function listFases(): Promise<ListResult<{ value: FaseTratamento; label: string }>> {
  return simulate(() =>
    ok(
      toOptions(FASE_TRATAMENTO_LABEL).map((opcao) => ({
        value: opcao.value as FaseTratamento,
        label: opcao.label,
      })),
    ),
  );
}
