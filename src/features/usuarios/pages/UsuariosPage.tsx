import { ModuloEmConstrucao, PageHeader } from "@/components/shared";

/**
 * Usuários
 *
 * Esqueleto criado na Fase 3 (AdminLayout). O conteúdo chega na Fase 6.
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/usuarios/
 */
export function UsuariosPage() {
  return (
    <>
      <PageHeader
        titulo="Usuários"
        subtitulo="16 profissionais cadastrados · 7 especialidades"
      />

      <ModuloEmConstrucao
        fase={6}
        prototipo="https://strawti.com.br/prototipos/jornada-supera/admin/usuarios/"
        entrega={[
          "Lista com iniciais, profissional, especialidade, registro, horário de chat e status",
          "Distribuição por especialidade no cabeçalho",
          "Cadastro com papel, permissões e horário de atendimento",
          "Matriz de permissões papel × permissão",
          "Histórico de acessos, ativar/desativar, reset de senha e gestão do segundo fator",
        ]}
      />
    </>
  );
}

export default UsuariosPage;
