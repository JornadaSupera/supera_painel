import { useState } from "react";

import { FileText, Lock, Plus } from "lucide-react";

import {
  BackendPendente,
  EmptyState,
  ErrorState,
  Footnote,
  PageHeader,
  ScrollableTabsList,
  SkeletonCards,
  StatusBadge,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import type { ItemCatalogo, VersaoLegal } from "@/types/configuracao";
import { ConsentimentosAceitos } from "../components/ConsentimentosAceitos";
import { DialogPublicarTermo } from "../components/DialogPublicarTermo";
import { ExigenciaSegundoFator } from "../components/ExigenciaSegundoFator";
import { FilaDeConferencia } from "../components/FilaDeConferencia";
import { GatilhosAlerta } from "../components/GatilhosAlerta";
import { MotivosSituacao } from "../components/MotivosSituacao";
import { SolicitacoesTitular } from "../components/SolicitacoesTitular";
import { useConfiguracoes, useTermos } from "../hooks/useConfiguracoes";

/**
 * Configurações — o que está valendo no sistema.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/configuracoes/
 *
 * > [!] A tela tem duas metades, e elas seguem regras opostas de propósito.
 * O **vocabulário** (sintomas, notificações, categorias, assuntos) é somente
 * leitura: o mesmo código alimenta o diário do paciente, os eixos dos
 * relatórios e o alvo do gatilho de alerta, e trocá-lo por formulário quebraria
 * os três de uma vez, sem revisão e sem migração para reverter.
 *
 * A **operação** — documento legal em vigor, grau que dispara alerta, motivos
 * de falta — é da clínica e muda com a rotina dela. Esperar uma migração para
 * cadastrar "paciente não tinha transporte" seria burocracia sem finalidade.
 *
 * O que o protótipo oferece e o backend não guarda — identidade visual, horário
 * de atendimento, textos de onboarding — continua nomeado item a item. Desenhar
 * campo que não salva é a pior forma de mentir numa interface.
 *
 * A tela detalhada de permissões vive em `/usuarios`, na aba "Permissões por
 * papel", como o próprio protótipo antecipa ao dizer que ela viria depois.
 */

const MOTIVOS_SEM_ORIGEM: Record<string, string> = {
  identidade_visual:
    "Logo da clínica: não há tabela de parâmetro nem bucket de marca no Storage. O logo usado hoje pelo aplicativo vem do pacote da build.",
  cor_primaria:
    "Cor primária: a paleta é token de tema no código, versionada junto com a interface. Ainda não é dado configurável.",
  horario_atendimento_chat:
    "Horário de atendimento no chat: não há tabela de janela de atendimento. As conversas hoje não distinguem dentro e fora do expediente.",
  resposta_automatica:
    "Resposta automática fora do horário: depende do horário de atendimento, que ainda não existe como dado.",
  textos_de_onboarding:
    "Textos de onboarding e mensagens automáticas: ainda não são dado do backend; hoje vivem no pacote do aplicativo.",
};

/** As duas espécies de documento, na ordem em que o aplicativo as pede. */
const ESPECIES_LEGAIS: { tipo: VersaoLegal["tipo"]; label: string }[] = [
  { tipo: "termos_de_uso", label: "Termos de uso" },
  { tipo: "politica_de_privacidade", label: "Política de privacidade" },
];

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
            // Wraps instead of truncating: when name and code do not fit side
            // by side, the code drops under the name rather than cutting it.
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate text-xs font-medium">{item.label}</p>
                {item.detalhe && (
                  <p className="text-muted-foreground truncate text-[11px]">{item.detalhe}</p>
                )}
              </div>

              <code className="text-muted-foreground shrink-0 font-mono text-[11px]">
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

  // Qual espécie está com o diálogo de publicação aberto. `null` = nenhuma.
  const [publicando, setPublicando] = useState<VersaoLegal["tipo"] | null>(null);

  const vigenteDe = (tipo: VersaoLegal["tipo"]) =>
    (termos.data ?? []).find((versao) => versao.tipo === tipo && versao.vigente) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        subtitle="Vocabulário do sistema, gatilhos de alerta, motivos de situação e documentos legais"
      />

      {configuracoes.isError && (
        <ErrorState error={configuracoes.error} onRetry={() => void configuracoes.refetch()} />
      )}

      <Tabs defaultValue="catalogos" className="flex flex-col gap-5">
        {/* Seven sections do not fit side by side below ~1100px. The list
            scrolls inside its own strip, so the page keeps its width. */}
        <ScrollableTabsList>
          <TabsTrigger value="catalogos">Catálogos do sistema</TabsTrigger>
          <TabsTrigger value="alertas">Gatilhos de alerta</TabsTrigger>
          <TabsTrigger value="motivos">Motivos de situação</TabsTrigger>
          <TabsTrigger value="legais">Termos & privacidade</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
          <TabsTrigger value="integracao">Integração</TabsTrigger>
          <TabsTrigger value="lgpd">Pedidos do titular</TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="catalogos" className="flex flex-col gap-5">
          {configuracoes.isLoading ? (
            <SkeletonCards count={4} />
          ) : (
            dados && (
              // `grid-cols-1` is `minmax(0, 1fr)`: the implicit column sized
              // itself to the longest technical code and pushed the cards
              // past a phone screen.
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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

          <Footnote>
            Os catálogos acima mudam por migração versionada, com revisão — não por formulário. O
            mesmo vocabulário alimenta o diário do paciente, os eixos dos relatórios e os gatilhos
            de alerta, e renomear um código aqui quebraria os três de uma vez. As regras de
            permissão por papel ficam em <strong>Usuários → Permissões por papel</strong>.
          </Footnote>
        </TabsContent>

        <TabsContent value="alertas">
          <GatilhosAlerta />
        </TabsContent>

        <TabsContent value="motivos">
          <MotivosSituacao />
        </TabsContent>

        <TabsContent value="legais" className="flex flex-col gap-4">
          {/* Uma ação por espécie: termos e política evoluem em ritmos
              diferentes, e a numeração do backend é separada. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground max-w-[64ch] text-xs leading-relaxed">
              O documento em vigor é o que o aplicativo exibe no aceite. Publicar uma versão nova
              aposenta a anterior e exige que todos os pacientes aceitem de novo.
            </p>

            <div className="flex shrink-0 gap-2">
              {ESPECIES_LEGAIS.map((especie) => (
                <Button
                  key={especie.tipo}
                  variant="outline"
                  size="sm"
                  onClick={() => setPublicando(especie.tipo)}
                >
                  <Plus />
                  {especie.label}
                </Button>
              ))}
            </div>
          </div>

          {termos.isLoading && <SkeletonCards count={2} />}

          {termos.isError && (
            <ErrorState error={termos.error} onRetry={() => void termos.refetch()} />
          )}

          {!termos.isLoading && (termos.data?.length ?? 0) === 0 && (
            <EmptyState
              title="Nenhuma versão publicada"
              description="Não há termos de uso nem política de privacidade registrados. Enquanto não houver, o aplicativo não tem texto para exibir no aceite — e nenhum paciente deveria entrar antes disso."
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

          <Footnote>
            O aceite é versionado: quem aceitou a versão anterior não aceitou a atual. É por isso
            que não existe "editar o texto vigente" — editar apagaria a prova do que cada pessoa
            aceitou, e o histórico acima é essa prova.
          </Footnote>

          {/* A contrapartida da publicação: uma cria a obrigação, a outra é a
              prova de que ela foi cumprida. */}
          <ConsentimentosAceitos />
        </TabsContent>

        <TabsContent value="seguranca">
          <ExigenciaSegundoFator />
        </TabsContent>

        <TabsContent value="integracao">
          <FilaDeConferencia />
        </TabsContent>

        <TabsContent value="lgpd">
          <SolicitacoesTitular />
        </TabsContent>
      </Tabs>

      {ESPECIES_LEGAIS.map((especie) => (
        <DialogPublicarTermo
          key={especie.tipo}
          tipo={especie.tipo}
          tipoLabel={especie.label}
          vigente={vigenteDe(especie.tipo)}
          aberto={publicando === especie.tipo}
          onFechar={() => setPublicando(null)}
        />
      ))}
    </div>
  );
}

export default ConfiguracoesPage;
