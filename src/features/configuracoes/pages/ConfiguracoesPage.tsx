import { ModuloEmConstrucao, PageHeader } from "@/components/shared";

/**
 * Configurações
 *
 * Esqueleto criado na Fase 3 (AdminLayout). O conteúdo chega na Fase 9.
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/configuracoes/
 */
export function ConfiguracoesPage() {
  return (
    <>
      <PageHeader
        titulo="Configurações"
        subtitulo="Identidade visual, mensagens, alertas, atendimento e termos"
      />

      <ModuloEmConstrucao
        fase={9}
        prototipo="https://strawti.com.br/prototipos/jornada-supera/admin/configuracoes/"
        entrega={[
          "Identidade visual: logo 512×512 e cor primária, com pré-visualização",
          "Sete gatilhos de alerta: febre, vômito, dor, sangramento, confusão, diarreia e fadiga",
          "Horário de atendimento do chat e resposta automática fora do horário",
          "Textos de onboarding e mensagens automáticas",
          "Termos de uso e política de privacidade, com versionamento",
        ]}
      />
    </>
  );
}

export default ConfiguracoesPage;
