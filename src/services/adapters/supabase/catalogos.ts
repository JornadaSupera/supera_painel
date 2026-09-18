import {
  ESPECIALIDADE_LABEL,
  FASE_TRATAMENTO_LABEL,
  type Especialidade,
  type FaseTratamento,
} from "@/lib/enums";
import { ok, type ListResult } from "@/services/contracts";
import type { Cid, EfeitoAdverso, Protocolo } from "@/types/catalogo";
import { executar, falhaDe } from "./_helpers";
import { getSupabaseClient } from "./client";
import { paraEspecialidade, paraFase } from "./mapping";

/**
 * Catálogos de apoio.
 *
 * São tabelas de vocabulário: leitura direta liberada a qualquer conta
 * autenticada, sem pedágio de auditoria, e por isso as únicas listas que o
 * painel busca inteiras sem pensar duas vezes.
 *
 * Vocabulário se aposenta com `is_active = false`, nunca se apaga — por isso o
 * filtro em todos os seletores.
 */

export async function listCids(): Promise<ListResult<Cid>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("cid10")
      .select("code, label")
      .eq("is_active", true)
      .order("code", { ascending: true });

    if (error) return falhaDe(error);

    return ok(
      (data as { code: string; label: string }[]).map<Cid>((linha) => ({
        codigo: linha.code,
        descricao: linha.label,
        // O capítulo do CID-10 é a letra inicial do código. `cid10` não tem
        // coluna de agrupamento, e a letra é o agrupamento oficial da
        // classificação — não é convenção nossa.
        grupo: linha.code.charAt(0).toUpperCase(),
      })),
    );
  });
}

/**
 * Protocolos terapêuticos.
 *
 * Não existem como catálogo: `treatment_plans.protocol_name` é texto livre, sem
 * tabela de domínio por trás. Levantar os nomes em uso exigiria ler o plano de
 * cada paciente por `read_treatment_plans`, uma chamada auditada por paciente,
 * só para preencher um `<Select>` de filtro.
 *
 * A lista vem vazia, e o filtro correspondente aparece sem opções — que é a
 * descrição honesta do estado do banco.
 */
export async function listProtocolos(): Promise<ListResult<Protocolo>> {
  return ok<Protocolo>([]);
}

export async function listEspecialidades(): Promise<ListResult<{ value: string; label: string }>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("specialties")
      .select("code, label")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) return falhaDe(error);

    const opcoes = (data as { code: string; label: string }[])
      .map((linha) => {
        const especialidade = paraEspecialidade(linha.code);
        return especialidade
          ? // O rótulo do painel prevalece sobre o do banco: é o texto que o
            // protótipo mostra, e a tabela guarda o nome da área ("Oncologia"),
            // não o do profissional ("Médico Oncologista").
            { value: especialidade, label: ESPECIALIDADE_LABEL[especialidade] }
          : null;
      })
      .filter((opcao): opcao is { value: Especialidade; label: string } => opcao !== null);

    return ok(opcoes);
  });
}

/**
 * Fases de tratamento.
 *
 * > [!] O catálogo é mais curto do que o vocabulário do painel.
 * `lib/enums` nomeia cinco fases porque o protótipo as desenha; `treatment_phases`
 * tem as que a clínica de fato usa, e aposenta uma com `is_active = false` em
 * vez de apagá-la. Filtrar por uma fase que o cadastro não tem devolve sempre
 * zero — um controle que parece funcionar e nunca acha ninguém.
 *
 * Fase do banco sem correspondente aqui também fica de fora: a tela não teria
 * como escrever o nome dela na coluna.
 */
export async function listFases(): Promise<ListResult<{ value: FaseTratamento; label: string }>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("treatment_phases")
      .select("code")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) return falhaDe(error);

    // `treatment_phases` também guarda os marcos do NPS (`primeiro_acesso`,
    // `ultimo_ciclo`), que não são fase de tratamento e não têm nome no painel:
    // `paraFase` os descarta. O Set protege contra a mesma fase aparecer duas
    // vezes, que o `sort_order` repetido da tabela deixa acontecer.
    const vistas = new Set<FaseTratamento>();
    const opcoes: { value: FaseTratamento; label: string }[] = [];

    for (const linha of data as { code: string }[]) {
      const fase = paraFase(linha.code);
      if (!fase || vistas.has(fase)) continue;

      vistas.add(fase);
      opcoes.push({ value: fase, label: FASE_TRATAMENTO_LABEL[fase] });
    }

    return ok(opcoes);
  });
}

/**
 * Efeitos adversos.
 *
 * A tabela `symptoms` é o catálogo dos 12 sintomas que o app do paciente
 * registra no diário — é dela que o cruzamento Protocolo × Efeito × Grau sai,
 * quando o nível Médio for construído. `is_psychological` marca os que só a
 * Psicologia enxerga, e é o que separa os dois agrupamentos.
 */
export async function listEfeitos(): Promise<ListResult<EfeitoAdverso>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("symptoms")
      .select("id, label, is_psychological")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) return falhaDe(error);

    return ok(
      (data as { id: string; label: string; is_psychological: boolean }[]).map<EfeitoAdverso>(
        (linha) => ({
          id: linha.id,
          nome: linha.label,
          sistema: linha.is_psychological ? "Psicológico" : "Físico",
        }),
      ),
    );
  });
}
