/**
 * Credenciais de desenvolvimento.
 *
 * Preenchem o formulário de acesso para que abrir o painel não exija digitação
 * — e permitem trocar de perfil com um clique, o que é a forma prática de
 * conferir o RBAC: cada papel enxerga uma sidebar diferente.
 *
 * > [!] Nada disso existe em produção.
 * Todo uso é envolvido por `import.meta.env.DEV`, então o bundle de produção
 * não contém estes valores — o Vite remove o ramo morto na build. Os dados
 * apontam para `src/mocks/usuarios.ts`, que também some na Fase 15.
 */

export interface CredencialDev {
  email: string;
  senha: string;
  rotulo: string;
  /** O que este perfil serve para testar. */
  descricao: string;
}

export const SENHA_DEV = "Supera@2026";

/** Código aceito pelo mock de MFA. */
export const CODIGO_MFA_DEV = "000000";

export const CREDENCIAIS_DEV: CredencialDev[] = [
  {
    email: "patricia.nunes@cosc.com.br",
    senha: SENHA_DEV,
    rotulo: "Administradora",
    descricao: "Todas as permissões, menos o sigilo de Psicologia",
  },
  {
    email: "ricardo.steil@cosc.com.br",
    senha: SENHA_DEV,
    rotulo: "Gestor",
    descricao: "Sem gestão de permissões nem exportação de auditoria",
  },
  {
    email: "ana.rocha@cosc.com.br",
    senha: SENHA_DEV,
    rotulo: "Médica oncologista",
    descricao: "Só leitura; vê apenas os próprios indicadores",
  },
  {
    email: "fernanda.ribas@cosc.com.br",
    senha: SENHA_DEV,
    rotulo: "Psicóloga",
    descricao: "Único perfil com sigilo:psicologia",
  },
];

/** Perfil que já vem preenchido ao abrir a tela. */
export const CREDENCIAL_PADRAO = CREDENCIAIS_DEV[0]!;
