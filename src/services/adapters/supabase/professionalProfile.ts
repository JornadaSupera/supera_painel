import { ERROR_CODE, fail, okOne, type SingleResult } from "@/services/contracts";
import type { PerfilProfissional } from "@/types/professional-profile";
import { executar, falhaDe, profissionalDaSessao, umDe } from "./_helpers";
import { getSupabaseClient } from "./client";
import { paraEspecialidade } from "./mapping";

interface LinhaMeuPerfil {
  created_at: string;
  professionals: {
    professional_specialties:
      | {
          is_primary: boolean;
          started_at: string;
          ended_at: string | null;
          specialties: { code: string } | { code: string }[] | null;
        }[]
      | null;
  } | null;
}

/**
 * O cadastro de quem está logado. Lê só a própria linha da conta: quem consulta
 * é a sessão, e não há parâmetro de "quem" a trocar. As áreas encerradas ficam
 * de fora, porque `ended_at` nulo é o que diz que a pessoa ainda atua nela.
 */
export async function getMeuPerfil(): Promise<SingleResult<PerfilProfissional>> {
  return executar(async () => {
    const eu = await profissionalDaSessao();
    if ("error" in eu) return eu;

    const { data, error } = await getSupabaseClient()
      .from("accounts")
      .select(
        "created_at, professionals ( professional_specialties ( is_primary, started_at, ended_at, specialties ( code ) ) )",
      )
      .eq("id", eu.contaId)
      .maybeSingle();
    if (error) return falhaDe(error);
    if (!data) return fail(ERROR_CODE.NOT_FOUND, "Não encontramos o seu cadastro.");

    const linha = data as unknown as LinhaMeuPerfil;
    const vinculos = umDe(linha.professionals)?.professional_specialties ?? [];

    const areas = vinculos
      .filter((vinculo) => !vinculo.ended_at)
      .flatMap((vinculo) => {
        const especialidade = paraEspecialidade(umDe(vinculo.specialties)?.code);
        return especialidade
          ? [{ especialidade, principal: vinculo.is_primary, desde: vinculo.started_at }]
          : [];
      })
      .sort((a, b) => Number(b.principal) - Number(a.principal));

    return okOne({ criado_em: linha.created_at ?? null, areas });
  });
}
