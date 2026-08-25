import { Ellipsis, History, KeyRound, Pause, Play, ShieldCheck, ShieldOff, SquarePen } from "lucide-react";
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

  const pausado = usuario.status === STATUS_USUARIO.PAUSADO;

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
          <DropdownMenuItem onSelect={() => onVerHistorico(usuario)}>
            <History />
            Histórico de acessos
          </DropdownMenuItem>

          <Can permissao={PERMISSAO.USUARIOS_MANAGE}>
            <DropdownMenuItem onSelect={() => navigate(`/usuarios/${usuario.id}`)}>
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

            <DropdownMenuItem
              variant={pausado ? "default" : "destructive"}
              disabled={alterarStatus.isPending}
              onSelect={() =>
                alterarStatus.mutate({
                  id: usuario.id,
                  status: pausado ? STATUS_USUARIO.ATIVO : STATUS_USUARIO.PAUSADO,
                })
              }
            >
              {pausado ? <Play /> : <Pause />}
              {pausado ? "Reativar acesso" : "Pausar acesso"}
            </DropdownMenuItem>
          </Can>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmandoMfa}
        onOpenChange={setConfirmandoMfa}
        tone="warning"
        titulo="Desativar o segundo fator?"
        descricao={`${usuario.nome} passará a entrar apenas com e-mail e senha. O painel dá acesso a prontuário oncológico — trate isto como exceção temporária.`}
        confirmLabel="Desativar"
        exigirMotivo
        loading={alterarMfa.isPending}
        onConfirm={({ motivo }) => {
          alterarMfa.mutate({ id: usuario.id, ativo: false, motivo });
          setConfirmandoMfa(false);
        }}
      />
    </div>
  );
}

export default AcoesUsuario;
