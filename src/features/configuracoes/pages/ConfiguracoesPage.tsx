import { FileText, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  BackendPendente,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonCards,
  StatusBadge,
} from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import { queryKeys } from "@/lib/queryKeys";
import { call, configuracoesApi } from "@/services/apiClient";
import type { ItemCatalogo } from "@/types/configuracao";

/**
 * Configurações — o que está valendo no sistema.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/configuracoes/
 *
 * > [!] Esta tela LÊ; ela não salva.
 * Nenhum catálogo do banco tem política de escrita para o painel, e a decisão
 * é deliberada: o mesmo vocabulário alimenta o diário do paciente, os eixos dos
 * relatórios e os gatilhos de alerta. Trocar um código por formulário quebraria
 * os três de uma vez, sem revisão e sem migração para reverter.
 *
 * O protótipo mostra campos editáveis de identidade visual, gatilhos de alerta
 * e horário de atendimento. Nenhum tem tabela no banco. Em vez de desenhar
 * campos que não salvam — que é a pior forma de mentir numa interface —, a tela
 * mostra o que existe e nomeia o que falta.
 *
 * A tela detalhada de permissões vive em `/usuarios`, na aba "Permissões por
 * papel", como o próprio protótipo antecipa ao dizer que ela viria depois.
 */

const MOTIVOS_SEM_ORIGEM: Record<string, string> = {
  identidade_visual:
    "Logo da clínica: não há tabela de parâmetro nem bucket de marca no Storage. O logo usado hoje pelo aplicativo vem do pacote da build.",
  cor_primaria:
    "Cor primária: a paleta é token de tema no código, versionada junto com a interface. Ainda não é dado configurável.",
  gatilhos_de_alerta:
    "Gatilhos de alerta (febre ≥ 37,8 °C, vômito grau 3+ e os demais): não existe tabela de limiar. O catálogo de sintomas está aqui, mas o grau que dispara notificação ainda não é dado.",
  horario_atendimento_chat:
    "Horário de atendimento no chat: não há tabela de janela de atendimento. As conversas hoje não distinguem dentro e fora do expediente.",
  resposta_automatica:
    "Resposta automática fora do horário: depende do horário de atendimento, que ainda não existe como dado.",
  textos_de_onboarding:
    "Textos de onboarding e mensagens automáticas: ainda não são dado do backend; hoje vivem no pacote do aplicativo.",
};

function useConfiguracoes() {
  return useQuery({
    queryKey: queryKeys.settings.get(),
    queryFn: async () => (await call(() => configuracoesApi.get())).data,
  });
}

function useTermos() {
  return useQuery({
    queryKey: queryKeys.settings.terms(),
    queryFn: async () => (await call(() => configuracoesApi.getTermos())).data,
  });
}

/** Uma lista de catálogo, em cartão. Somente leitura, e isso fica dito. */
function Catalogo({
  titulo,
  descricao,
  itens,
}: {
  titulo: string;
  descricao: string;
  itens: ItemCatalogo[];
}) {
  return (
    <section className="bg-card rounded-2xl border p-5">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-foreground text-sm font-semibold">{titulo}</h2>
          <p className="text-muted-foreground text-xs">{descricao}</p>
        </div>

        <StatusBadge tone="neutral" size="sm" className="shrink-0">
          <Lock size={10} aria-hidden="true" className="mr-1" />
          Somente leitura
        </StatusBadge>
      </header>

      {itens.length === 0 ? (
        <EmptyState compact title="Catálogo vazio" />
      ) : (
        <ul className="divide-border divide-y">
          {itens.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-foreground truncate text-xs font-medium">{item.label}</p>
                {item.detalhe && (
                  <p className="text-muted-foreground truncate text-[11px]">{item.detalhe}</p>
                )}
              </div>

              <code className="text-muted-foreground shrink-0 font-mono text-[10px]">
                {item.codigo}
              </code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ConfiguracoesPage() {
  const configuracoes = useConfiguracoes();
  const termos = useTermos();

  const dados = configuracoes.data;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        level="MVP"
        subtitle="Vocabulário do sistema, notificações e documentos legais em vigor"
      />

      {configuracoes.isError && (
        <ErrorState error={configuracoes.error} onRetry={() => void configuracoes.refetch()} />
      )}

      <Tabs defaultValue="catalogos" className="flex flex-col gap-5">
        <TabsList>
          <TabsTrigger value="catalogos">Catálogos do sistema</TabsTrigger>
          <TabsTrigger value="legais">Termos & privacidade</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogos" className="flex flex-col gap-5">
          {configuracoes.isLoading ? (
            <SkeletonCards count={4} />
          ) : (
            dados && (
              <div className="grid gap-5 lg:grid-cols-2">
                <Catalogo
                  titulo="Sintomas do diário"
                  descricao="Os sintomas que o paciente marca, e o eixo dos relatórios clínicos"
                  itens={dados.sintomas}
                />
                <Catalogo
                  titulo="Tipos de notificação"
                  descricao="O que o aplicativo envia, e o que não pode ser silenciado"
                  itens={dados.notificacoes}
                />
                <Catalogo
                  titulo="Categorias de conteúdo"
                  descricao="Os chips de filtro da biblioteca de orientações"
                  itens={dados.categorias_conteudo}
                />
                <Catalogo
                  titulo="Assuntos do chat"
                  descricao="O que o paciente escolhe ao abrir uma conversa"
                  itens={dados.assuntos_chat}
                />
              </div>
            )
          )}

          {/* O que a tela de referência oferece e o backend não guarda. Cada
              item nomeado, para que se saiba o que pedir. */}
          {(dados?.sem_origem.length ?? 0) > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-foreground text-sm font-semibold">
                Ainda não configurável pelo painel
              </h2>

              {(dados?.sem_origem ?? []).map((chave) => (
                <BackendPendente
                  key={chave}
                  motivo={MOTIVOS_SEM_ORIGEM[chave] ?? `Configuração "${chave}" sem origem no backend.`}
                />
              ))}
            </div>
          )}

          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Os catálogos acima mudam por migração versionada, com revisão — não por formulário. O
            mesmo vocabulário alimenta o diário do paciente, os eixos dos relatórios e os gatilhos
            de alerta, e renomear um código aqui quebraria os três de uma vez. As regras de
            permissão por papel ficam em <strong>Usuários → Permissões por papel</strong>.
          </p>
        </TabsContent>

        <TabsContent value="legais" className="flex flex-col gap-4">
          {termos.isLoading && <SkeletonCards count={2} />}

          {termos.isError && (
            <ErrorState error={termos.error} onRetry={() => void termos.refetch()} />
          )}

          {!termos.isLoading && (termos.data?.length ?? 0) === 0 && (
            <EmptyState
              title="Nenhuma versão publicada"
              description="Não há termos de uso nem política de privacidade registrados no banco. Enquanto não houver, o aplicativo não tem texto para exibir no aceite."
            />
          )}

          {(termos.data ?? []).map((versao) => (
            <article key={versao.id} className="bg-card rounded-2xl border p-5">
              <header className="mb-3 flex flex-wrap items-center gap-2">
                <FileText size={15} aria-hidden="true" className="text-muted-foreground" />
                <h2 className="text-foreground text-sm font-semibold">{versao.tipo_label}</h2>

                <StatusBadge tone={versao.vigente ? "success" : "neutral"} size="sm" dot>
                  {versao.vigente ? "Em vigor" : "Histórico"}
                </StatusBadge>

                <span className="text-muted-foreground text-[11px] tabular-nums">
                  versão {versao.versao}
                  {versao.publicado_em && ` · publicada em ${formatDate(versao.publicado_em)}`}
                </span>
              </header>

              {/* Texto puro, em parágrafos: nada de `dangerouslySetInnerHTML`
                  num documento que vira aceite jurídico. */}
              <div className="max-h-56 overflow-y-auto pr-1">
                {versao.corpo
                  .split(/\n{2,}/)
                  .filter((trecho) => trecho.trim() !== "")
                  .map((paragrafo, indice) => (
                    <p
                      key={`${versao.id}-${indice}`}
                      className="text-muted-foreground mb-2 text-xs leading-relaxed last:mb-0"
                    >
                      {paragrafo}
                    </p>
                  ))}
              </div>
            </article>
          ))}

          <BackendPendente
            titulo="Publicar nova versão"
            motivo="Publicar uma nova versão dos termos cria obrigação de novo aceite para todos os pacientes. A tabela só permite leitura pelo painel — a publicação vem pela migração que traz o texto revisado."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ConfiguracoesPage;
