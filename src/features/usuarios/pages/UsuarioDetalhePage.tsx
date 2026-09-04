import { History, KeyRound, IdCard, ShieldCheck, SquarePen } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  Can,
  DetailField,
  DetailSection,
  ErrorState,
  PageHeader,
  SkeletonForm,
  StatusBadge,
  TONE_USER_STATUS,
  UserAvatar,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ESPECIALIDADE_LABEL,
  PAPEL_LABEL,
  STATUS_USUARIO_LABEL,
  CONSELHO_POR_ESPECIALIDADE,
} from "@/lib/enums";
import { formatDateTime } from "@/lib/format";
import { PERMISSAO, PERMISSAO_LABEL } from "@/lib/rbac";
import { motivoIndisponivel } from "@/services/apiClient";
import { HistoricoAcessos } from "../components/HistoricoAcessos";
import { useResetarSenha, useUsuario } from "../hooks/useUsuarios";

/**
 * Ficha do profissional — leitura.
 *
 * Existe porque abrir um usuário levava direto ao formulário de edição, e com
 * a edição indisponível no backend a linha simplesmente não abria nada. Ver
 * quem é a pessoa, qual o alcance dela e quando ela acessou o painel é
 * informação de trabalho por si só, independente de poder alterá-la.
 *
 * As permissões vêm resolvidas da camada de dados (papel → especialidade →
 * extras). A tela não recalcula regra de acesso: duas implementações da mesma
 * regra é como as duas passam a discordar.
 */
export function UsuarioDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const { data: usuario, isLoading, isError, error, refetch } = useUsuario(id);
  const resetarSenha = useResetarSenha();

  const semEdicao = motivoIndisponivel("usuarios.update");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader eyebrow="Gestão" title="Profissional" backTo="/usuarios" />
        <SkeletonForm fields={7} className="max-w-2xl" />
      </div>
    );
  }

  if (isError || !usuario) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader eyebrow="Gestão" title="Profissional" backTo="/usuarios" />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  const conselho = usuario.especialidade
    ? CONSELHO_POR_ESPECIALIDADE[usuario.especialidade]
    : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Gestão"
        title={usuario.nome}
        backTo="/usuarios"
        backLabel="Usuários"
        breadcrumb={[{ label: "Usuários", to: "/usuarios" }, { label: usuario.nome }]}
        badge={
          <StatusBadge tone={TONE_USER_STATUS[usuario.status]} size="sm" dot>
            {STATUS_USUARIO_LABEL[usuario.status]}
          </StatusBadge>
        }
        subtitle={usuario.email}
        actions={
          <Can permission={PERMISSAO.USUARIOS_MANAGE}>
            <Button variant="outline" onClick={() => setHistoricoAberto(true)}>
              <History />
              Histórico de acessos
            </Button>

            <Button
              variant="outline"
              disabled={resetarSenha.isPending}
              onClick={() => resetarSenha.mutate(usuario.id)}
            >
              <KeyRound />
              Enviar link de nova senha
            </Button>

            <Button
              disabled={semEdicao !== null}
              title={semEdicao ?? undefined}
              onClick={() => navigate(`/usuarios/${usuario.id}/editar`)}
            >
              <SquarePen />
              Editar
            </Button>
          </Can>
        }
      />

      <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
        <DetailSection titulo="Identificação" icone={<IdCard size={15} />}>
          <div className="flex items-center gap-3">
            <UserAvatar name={usuario.nome} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {usuario.tratamento ? `${usuario.tratamento} ` : ""}
                {usuario.nome}
              </p>
              <p className="text-muted-foreground truncate text-xs">{usuario.email}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4">
            <DetailField rotulo="Papel">{PAPEL_LABEL[usuario.papel]}</DetailField>

            <DetailField rotulo="Especialidade">
              {usuario.especialidade ? ESPECIALIDADE_LABEL[usuario.especialidade] : undefined}
            </DetailField>

            <DetailField rotulo={conselho ?? "Registro"}>
              {usuario.registro ? (
                <span className="tabular-nums">{usuario.registro}</span>
              ) : undefined}
            </DetailField>

            <DetailField rotulo="Cadastrado em">
              <span className="tabular-nums">{formatDateTime(usuario.criado_em)}</span>
            </DetailField>
          </dl>
        </DetailSection>

        <DetailSection titulo="Acesso" icone={<ShieldCheck size={15} />}>
          <dl className="grid grid-cols-2 gap-4">
            <DetailField rotulo="Situação">
              <StatusBadge tone={TONE_USER_STATUS[usuario.status]} size="sm" dot>
                {STATUS_USUARIO_LABEL[usuario.status]}
              </StatusBadge>
            </DetailField>

            <DetailField rotulo="Segundo fator">
              {/*
                `null` quer dizer que a origem dos dados não informa o segundo
                fator de terceiros — diferente de saber que está desligado.
              */}
              {usuario.mfa_ativo === null
                ? undefined
                : usuario.mfa_ativo
                  ? "Ativo"
                  : "Desativado"}
            </DetailField>

            <DetailField rotulo="Último acesso">
              {usuario.ultimo_acesso_em ? (
                <span className="tabular-nums">{formatDateTime(usuario.ultimo_acesso_em)}</span>
              ) : undefined}
            </DetailField>

            <DetailField rotulo="Janela de atendimento">
              {usuario.horario_inicio && usuario.horario_fim
                ? `${usuario.horario_inicio}–${usuario.horario_fim}`
                : undefined}
            </DetailField>
          </dl>
        </DetailSection>

        <DetailSection titulo="Permissões efetivas" icone={<ShieldCheck size={15} />}>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Conjunto já resolvido pelo backend: papel, depois especialidade, depois concessões
            individuais.
          </p>

          {usuario.permissoes_efetivas.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma permissão concedida.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {usuario.permissoes_efetivas.map((permissao) => (
                <li key={permissao}>
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {PERMISSAO_LABEL[permissao] ?? permissao}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </DetailSection>
      </div>

      <HistoricoAcessos
        usuario={usuario}
        aberto={historicoAberto}
        onOpenChange={setHistoricoAberto}
      />
    </div>
  );
}

export default UsuarioDetalhePage;
