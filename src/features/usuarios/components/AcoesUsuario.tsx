import { IdCard, Ellipsis, History, KeyRound, Pause, Play, ShieldCheck, ShieldOff, SquarePen } from "lucide-react";
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
import { useAlterarMfa, useAlterarStatus, useResetarSenha } from "../hooks/useUsuarios";

/**
 * Ações de uma linha da lista de profissionais.
 *
 * "Pausar" em vez de excluir: o vínculo com a clínica continua, o acesso é que
 * suspende — e o histórico de atendimento precisa seguir apontando para alguém.
 * Exclusão de conta com trilha de auditoria apontando para ela é registro órfão.
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

  const alterarStatus = useAlterarStatus();
  const resetarSenha = useResetarSenha();
  const alterarMfa = useAlterarMfa();

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
              Suspender acesso tem duas formas, e qual delas existe depende do
              backend. Onde há pausa, ela mantém o vínculo e suspende o acesso;
              onde não há, resta desativar — que é a revogação completa, vale
              para todos os perfis da pessoa de uma vez e por isso é dita com
              essa palavra, não disfarçada de "pausar".
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
              {suspenso ? "Reativar acesso" : semPausa ? "Desativar acesso" : "Pausar acesso"}
            </DropdownMenuItem>
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
        requireReason
        loading={alterarMfa.isPending}
        onConfirm={({ reason }) => {
          alterarMfa.mutate({ id: usuario.id, ativo: false, motivo: reason });
          setConfirmandoMfa(false);
        }}
      />
    </div>
  );
}

export default AcoesUsuario;
