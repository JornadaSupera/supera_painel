import {
  Ellipsis,
  History,
  IdCard,
  KeyRound,
  Pause,
  Play,
  ShieldCheck,
  ShieldOff,
  SquarePen,
  UserX,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Can, ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_USUARIO } from "@/lib/enums";
import { PERMISSAO } from "@/lib/rbac";
import { motivoIndisponivel } from "@/services/apiClient";
import type { UsuarioListItem } from "@/types/usuario";
import {
  useAlterarMfa,
  useAlterarStatus,
  useDesativarConta,
  useResetarSenha,
} from "../hooks/useUsuarios";

/**
 * Ações de uma linha da lista de profissionais.
 *
 * Suspender em vez de excluir: o vínculo com a clínica continua, o acesso é que
 * para — e o histórico de atendimento precisa seguir apontando para alguém.
 * Exclusão de conta com trilha de auditoria apontando para ela é registro órfão.
 *
 * > [!] Revogar o acesso ao painel e desativar a conta são atos diferentes.
 * O primeiro desliga o perfil e deixa a pessoa com a conta, o aplicativo e os
 * aparelhos dela. O segundo derruba tudo. Eram um item só até aqui, e o item
 * fazia o segundo enquanto a tela dizia o primeiro.
 */
export function AcoesUsuario({
  usuario,
  onVerHistorico,
}: {
  usuario: UsuarioListItem;
  onVerHistorico: (usuario: UsuarioListItem) => void;
}) {
  const navigate = useNavigate();
  const [confirmandoMfa, setConfirmandoMfa] = useState(false);
  const [confirmandoConta, setConfirmandoConta] = useState(false);

  const alterarStatus = useAlterarStatus();
  const resetarSenha = useResetarSenha();
  const alterarMfa = useAlterarMfa();
  const desativarConta = useDesativarConta();

  // Acesso suspenso é pausado ou inativo: qual dos dois o backend usa depende
  // de ele ter estado de pausa. Para a tela, os dois significam "não entra".
  const suspenso =
    usuario.status === STATUS_USUARIO.PAUSADO || usuario.status === STATUS_USUARIO.INATIVO;

  const semEdicao = motivoIndisponivel("usuarios.update");
  const semMfa = motivoIndisponivel("usuarios.setMfa");
  const semPausa = motivoIndisponivel("usuarios.pause") !== null;

  return (
    <div onClick={(evento) => evento.stopPropagation()} role="presentation">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Ações de ${usuario.nome}`}
            className="text-muted-foreground"
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => navigate(`/usuarios/${usuario.id}`)}>
            <IdCard />
            Ver ficha
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => onVerHistorico(usuario)}>
            <History />
            Histórico de acessos
          </DropdownMenuItem>

          <Can permission={PERMISSAO.USUARIOS_MANAGE}>
            <DropdownMenuItem
              disabled={semEdicao !== null}
              title={semEdicao ?? undefined}
              onSelect={() => navigate(`/usuarios/${usuario.id}/editar`)}
            >
              <SquarePen />
              Editar cadastro
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              disabled={resetarSenha.isPending}
              onSelect={() => resetarSenha.mutate(usuario.id)}
            >
              <KeyRound />
              Enviar link de nova senha
            </DropdownMenuItem>

            <DropdownMenuItem
              disabled={semMfa !== null}
              title={semMfa ?? undefined}
              onSelect={() => {
                // Ligar é seguro e imediato. Desligar exige justificativa — daí
                // o diálogo em um caminho e não no outro.
                if (usuario.mfa_ativo) setConfirmandoMfa(true);
                else alterarMfa.mutate({ id: usuario.id, ativo: true });
              }}
            >
              {usuario.mfa_ativo ? <ShieldOff /> : <ShieldCheck />}
              {usuario.mfa_ativo ? "Desativar segundo fator" : "Ativar segundo fator"}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/*
              DOIS ATOS DE TAMANHOS DIFERENTES, e por isso dois itens.

              Revogar o acesso ao painel desliga o PERFIL: a pessoa para de
              operar o painel e continua com a conta, o aplicativo e os
              aparelhos registrados. É a revogação oficial.

              Desativar a conta derruba tudo de uma vez — todos os perfis, o
              aplicativo e o push. Um item só para os dois escolheria o errado
              metade das vezes, e o errado aqui é grande nos dois sentidos.
            */}
            <DropdownMenuItem
              variant={suspenso ? "default" : "destructive"}
              disabled={alterarStatus.isPending}
              onSelect={() =>
                alterarStatus.mutate({
                  id: usuario.id,
                  status: suspenso
                    ? STATUS_USUARIO.ATIVO
                    : semPausa
                      ? STATUS_USUARIO.INATIVO
                      : STATUS_USUARIO.PAUSADO,
                })
              }
            >
              {suspenso ? <Play /> : <Pause />}
              {suspenso
                ? "Devolver acesso ao painel"
                : semPausa
                  ? "Revogar acesso ao painel"
                  : "Pausar acesso"}
            </DropdownMenuItem>

            {!suspenso && (
              <DropdownMenuItem
                variant="destructive"
                disabled={desativarConta.isPending}
                onSelect={() => setConfirmandoConta(true)}
              >
                <UserX />
                Desativar a conta inteira
              </DropdownMenuItem>
            )}
          </Can>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmandoMfa}
        onOpenChange={setConfirmandoMfa}
        tone="warning"
        title="Desativar o segundo fator?"
        description={`${usuario.nome} passará a entrar apenas com e-mail e senha. O painel dá acesso a prontuário oncológico — trate isto como exceção temporária.`}
        confirmLabel="Desativar"
        loading={alterarMfa.isPending}
        onConfirm={({ reason }) => {
          alterarMfa.mutate({ id: usuario.id, ativo: false, motivo: reason });
          setConfirmandoMfa(false);
        }}
      />

      {/* O alcance é o que precisa ficar claro antes do clique: não é sair do
          painel, é sair da plataforma. */}
      <ConfirmDialog
        open={confirmandoConta}
        onOpenChange={setConfirmandoConta}
        title="Desativar a conta inteira?"
        description={`${usuario.nome} perde o acesso a todos os perfis e ao aplicativo, e os aparelhos registrados deixam de receber notificação. Para tirar só o acesso ao painel, use "Revogar acesso ao painel".`}
        confirmLabel="Desativar a conta"
        loading={desativarConta.isPending}
        onConfirm={({ reason }) => {
          desativarConta.mutate({ id: usuario.id, ativa: false, motivo: reason });
          setConfirmandoConta(false);
        }}
      />
    </div>
  );
}

export default AcoesUsuario;
