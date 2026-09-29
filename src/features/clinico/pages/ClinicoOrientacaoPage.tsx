import { useParams } from "react-router-dom";

import { ErrorState, PageHeader, SkeletonForm } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import { isEditableStatus } from "@/lib/content";
import { ESPECIALIDADE_LABEL } from "@/lib/enums";
import { FormularioOrientacao } from "../components/FormularioOrientacao";
import { LeituraDaOrientacao } from "../components/LeituraDaOrientacao";
import { useOrientacao } from "../hooks/useOrientacoes";

/**
 * Uma orientação: a nova (`/conteudo/nova`) ou uma existente (`/conteudo/:id`).
 *
 * Rascunho e devolvida abrem o formulário; o resto abre em leitura. O `id` da
 * rota é o da VERSÃO, o mesmo que a revisão do administrador recebe.
 */
export function ClinicoOrientacaoPage() {
  const { user } = useAuth();
  const { especialidade, id } = useParams<{ especialidade: string; id: string }>();
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  const base = `/clinico/${especialidade}/conteudo`;
  const orientacao = useOrientacao(id);
  const nova = !id;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area}
        title={nova ? "Nova orientação" : (orientacao.data?.titulo ?? "Orientação")}
        subtitle={nova ? "Salva como rascunho até você enviar para revisão" : undefined}
        backTo={base}
        backLabel="Voltar para Minhas orientações"
      />

      {!nova && orientacao.isLoading && <SkeletonForm />}

      {!nova && orientacao.isError && (
        <ErrorState error={orientacao.error} onRetry={() => void orientacao.refetch()} />
      )}

      {nova && <FormularioOrientacao basePath={base} />}

      {orientacao.data &&
        (isEditableStatus(orientacao.data.status) ? (
          // A chave é a versão e o estado, não o instante da resposta: salvar o
          // rascunho refaz a consulta, e remontar o formulário a cada salvamento
          // tiraria o cursor de quem está escrevendo.
          <FormularioOrientacao
            key={`${orientacao.data.id}:${orientacao.data.status}`}
            orientacao={orientacao.data}
            basePath={base}
          />
        ) : (
          <LeituraDaOrientacao orientacao={orientacao.data} />
        ))}
    </div>
  );
}

export default ClinicoOrientacaoPage;
