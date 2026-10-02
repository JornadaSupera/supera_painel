import {
  Ban,
  Ellipsis,
  History,
  IdCard,
  KeyRound,
  Pause,
  Play,
  RotateCcw,
  Send,
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
import { useAuth } from "@/contexts/auth-context";
import { useReforcoDaSessao } from "@/hooks/useReforcoDaSessao";
import { STATUS_USUARIO } from "@/lib/enums";
import { PERMISSAO } from "@/lib/rbac";
import { motivoIndisponivel } from "@/services/apiClient";
import type { UsuarioListItem } from "@/types/usuario";
import {
  useAlterarStatus,
  useCancelarConvite,
  useDesativarConta,
  useRedefinirFator,
  useReenviarConvite,
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
 *
 * > [!] Quem foi convidado e ainda não abriu o link tem outro menu.
 * O perfil existe e não vale nada: não há acesso a revogar nem senha a trocar, e
 * o banco recusa ligar ou desligar o perfil (`staff_invitation_pending`). O que
 * cabe é reenviar o convite ou desistir dele — desativando a conta, que é o
 * caminho que o banco oferece.
 */
export function AcoesUsuario({
  usuario,
  onVerHistorico,
}: {
  usuario: UsuarioListItem;
  onVerHistorico: (usuario: UsuarioListItem) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { exigir, dialogo } = useReforcoDaSessao();

  const [confirmandoMfa, setConfirmandoMfa] = useState(false);
  const [confirmandoConta, setConfirmandoConta] = useState(false);
  const [confirmandoConvite, setConfirmandoConvite] = useState(false);

  const alterarStatus = useAlterarStatus();
  const resetarSenha = useResetarSenha();
  const redefinirFator = useRedefinirFator();
  const desativarConta = useDesativarConta();
  const reenviarConvite = useReenviarConvite();
  const cancelarConvite = useCancelarConvite();

  const suspenso = usuario.status === STATUS_USUARIO.INATIVO;
  const convite = usuario.convite_pendente;
  const conviteDesistido = convite && suspenso;
  // Ninguém redefine o próprio autenticador por aqui: a função recusa, e o
  // caminho de quem é dono dele é a tela Segurança.
  const ehVoce = user?.id === usuario.id;

  const semEdicao = motivoIndisponivel("usuarios.update");

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

            {convite ? (
              <>
                {conviteDesistido ? (
                  <DropdownMenuItem
                    disabled={cancelarConvite.isPending}
                    onSelect={() => cancelarConvite.mutate({ id: usuario.id, ativa: true })}
                  >
                    <RotateCcw />
                    Retomar convite
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem
                      disabled={reenviarConvite.isPending}
                      onSelect={() => void exigir(() => reenviarConvite.mutate(usuario.id))}
                    >
                      <Send />
                      Reenviar convite
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      variant="destructive"
                      disabled={cancelarConvite.isPending}
                      onSelect={() => setConfirmandoConvite(true)}
                    >
                      <Ban />
                      Cancelar convite
                    </DropdownMenuItem>
                  </>
                )}
              </>
            ) : (
              <>
                <DropdownMenuItem
                  disabled={resetarSenha.isPending}
                  onSelect={() => resetarSenha.mutate(usuario.id)}
                >
                  <KeyRound />
                  Enviar link de nova senha
                </DropdownMenuItem>

                {!ehVoce && (
                  <DropdownMenuItem
                    disabled={redefinirFator.isPending}
                    onSelect={() => setConfirmandoMfa(true)}
                  >
                    <ShieldOff />
                    Redefinir segundo fator
                  </DropdownMenuItem>
                )}

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
                      status: suspenso ? STATUS_USUARIO.ATIVO : STATUS_USUARIO.INATIVO,
                    })
                  }
                >
                  {suspenso ? <Play /> : <Pause />}
                  {suspenso ? "Devolver acesso ao painel" : "Revogar acesso ao painel"}
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
              </>
            )}
          </Can>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmandoMfa}
        onOpenChange={setConfirmandoMfa}
        tone="warning"
        title="Redefinir o segundo fator?"
        description={`${usuario.nome} perde o aplicativo autenticador cadastrado e todas as sessões abertas, e entra só com e-mail e senha até cadastrar outro. Se for administrador e a exigência do segundo fator estiver ligada, fica sem o acesso administrativo até recadastrar.`}
        confirmLabel="Redefinir"
        loading={redefinirFator.isPending}
        onConfirm={({ reason }) => {
          setConfirmandoMfa(false);
          void exigir(() => redefinirFator.mutate({ id: usuario.id, motivo: reason }));
        }}
      />

      <ConfirmDialog
        open={confirmandoConvite}
        onOpenChange={setConfirmandoConvite}
        title="Cancelar o convite?"
        description={`A conta de ${usuario.nome} é desativada. Mesmo que a pessoa abra o link do e-mail depois, ela não entra. Dá para retomar o convite depois.`}
        confirmLabel="Cancelar convite"
        loading={cancelarConvite.isPending}
        onConfirm={({ reason }) => {
          cancelarConvite.mutate({ id: usuario.id, ativa: false, motivo: reason });
          setConfirmandoConvite(false);
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

      {dialogo}
    </div>
  );
}

export default AcoesUsuario;
