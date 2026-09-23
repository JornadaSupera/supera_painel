import { KeyRound, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import type { GarantiaDaSessao } from "@/types/auth";

/**
 * A tela que aparece no lugar do painel quando a sessão não cumpre a exigência
 * de segundo fator.
 *
 * > [!] Ela existe para substituir um vazio, não um erro.
 * Sem ela, esta mesma sessão abriria o painel inteiro e veria zero pacientes,
 * zero registros na trilha e zero itens em cada catálogo — porque as políticas
 * do backend deixam de reconhecer a sessão como administrativa e devolvem
 * **nenhuma linha, sem erro**. A tela mais perigosa de um sistema de saúde é a
 * que afirma ausência com a mesma cara com que afirmaria presença.
 *
 * O texto muda conforme a conta ter ou não autenticador, porque a ação também
 * muda: quem tem precisa entrar de novo e usar o código; quem não tem precisa
 * que alguém cadastre o fator — e isso ainda não acontece pelo painel.
 */

export interface SessaoSemSegundoFatorProps {
  garantia: GarantiaDaSessao;
}

export function SessaoSemSegundoFator({ garantia }: SessaoSemSegundoFatorProps) {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="bg-card w-full max-w-lg rounded-2xl border p-8 text-center">
        <span
          aria-hidden="true"
          className="bg-warning-bg text-warning-foreground mx-auto mb-4 flex size-12 items-center justify-center rounded-full"
        >
          <ShieldAlert size={22} />
        </span>

        <h1 className="text-foreground text-lg font-semibold">
          Esta sessão precisa do segundo fator
        </h1>

        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          O acesso administrativo passou a exigir verificação em duas etapas. Esta sessão entrou
          apenas com a senha, então o sistema não a reconhece como administrativa.
        </p>

        {/* A parte que ninguém adivinharia sozinho, e a razão de esta tela
            existir: o sintoma não é um erro, é o painel inteiro em branco. */}
        <p className="text-muted-foreground border-border mt-4 border-t pt-4 text-xs leading-relaxed">
          Se continuasse, o painel abriria com{" "}
          <strong className="text-foreground font-medium">tudo zerado</strong> — nenhum paciente,
          nenhum registro na trilha, nenhum catálogo. Não é falta de dado: é falta de
          reconhecimento da sessão.
        </p>

        {garantia.fator_cadastrado ? (
          <>
            <p className="text-foreground mt-5 text-sm">
              Sua conta já tem um aplicativo autenticador cadastrado. Entre de novo e informe o
              código para retomar de onde parou.
            </p>

            <Button className="mt-4" onClick={() => void signOut()}>
              <KeyRound />
              Entrar novamente
            </Button>
          </>
        ) : (
          <>
            <p className="text-foreground mt-5 text-sm">
              Sua conta ainda não tem um aplicativo autenticador cadastrado. O cadastro do fator
              não é feito por esta tela — procure quem administra a plataforma.
            </p>

            <Button variant="outline" className="mt-4" onClick={() => void signOut()}>
              Sair
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default SessaoSemSegundoFator;
