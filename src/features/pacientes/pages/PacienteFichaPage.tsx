import {
  Ban,
  CalendarDays,
  MessageSquareShare,
  Smartphone,
  SquarePen,
  Stethoscope,
  TriangleAlert,
  User,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  BackendPendente,
  Can,
  DetailField,
  DetailSection,
  ConfirmDialog,
  ErrorState,
  PageHeader,
  SkeletonForm,
  StatusBadge,
  TONE_RISK,
  TONE_PATIENT_STATUS,
  UserAvatar,
} from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FASE_TRATAMENTO_LABEL,
  RISCO_LABEL,
  STATUS_PACIENTE,
  STATUS_PACIENTE_LABEL,
} from "@/lib/enums";
import { formatDate, formatDateTime, ageInYears, relativeTime } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import { STATUS_CONVITE_LABEL, type PacienteDetalhe } from "@/types/paciente";
import { CampoSensivel } from "../components/CampoSensivel";
import { motivoIndisponivel } from "@/services/apiClient";
import { PacienteForm } from "../components/PacienteForm";
import {
  useAtualizarPaciente,
  useDesativarPaciente,
  useEnviarConvite,
  usePaciente,
} from "../hooks/usePacientes";
import { paraEntrada, VALORES_INICIAIS, type PacienteForm as Valores } from "../schemas";

/**
 * Ficha do paciente.
 *
 * Leitura e edição na mesma rota, alternadas por `?editar=1`. O escopo define
 * três rotas para pacientes — lista, novo e ficha —, então a edição não ganha
 * uma quarta: ela é um modo da ficha, e volta para a leitura ao salvar.
 *
 * Abrir esta tela é um evento de auditoria: é aqui que os dados de uma pessoa
 * identificada aparecem juntos. O registro sai de `usePaciente`.
 */

/* ------------------------------------------------------------- apoio */


/** Converte a ficha no formato do formulário — a ponte entre leitura e edição. */
function paraFormulario(paciente: PacienteDetalhe): Valores {
  return {
    ...VALORES_INICIAIS,
    nome: paciente.nome,
    // A edição não altera o CPF: o campo aparece desabilitado, com o valor
    // mascarado que a camada de dados enviou.
    cpf: paciente.cpf_mascarado,
    nascimento: paciente.nascimento,
    sexo: paciente.sexo ?? "feminino",
    cid: paciente.cid,
    protocolo_id: paciente.protocolo_id,
    fase: paciente.fase ?? "ativo",
    risco: paciente.risco ?? "baixo",
    estadiamento: paciente.estadiamento ?? "",
    diagnostico_em: paciente.diagnostico_em?.slice(0, 10) ?? "",
    medico_responsavel_id: paciente.medico_responsavel_id ?? "",
    alergias: paciente.alergias,
    reacoes_previas: paciente.reacoes_previas,
    observacoes: paciente.observacoes ?? "",
    // Contato começa vazio: vazio significa "manter o atual". Ver
    // `pacienteEdicaoSchema`.
    telefone: "",
    email: "",
    enviar_convite: false,
  };
}

/* -------------------------------------------------------------- tela */

export function PacienteFichaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmando, setConfirmando] = useState(false);

  const { data: paciente, isLoading, isError, error, refetch } = usePaciente(id);
  const atualizar = useAtualizarPaciente(id ?? "");
  const desativar = useDesativarPaciente();
  const convite = useEnviarConvite();

  const editando = searchParams.get("editar") === "1";

  const semEdicao = motivoIndisponivel("pacientes.update");
  const semConvite = motivoIndisponivel("pacientes.sendInvite");
  const semDesativar = motivoIndisponivel("pacientes.deactivate");
  const sairDaEdicao = () => setSearchParams({}, { replace: true });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader eyebrow="Gestão" title="Ficha do paciente" />
        <SkeletonForm fields={8} className="max-w-3xl" />
      </div>
    );
  }

  if (isError || !paciente) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const inativo = paciente.status === STATUS_PACIENTE.INATIVO;

  /* ------------------------------------------------------------ edição */

  if (editando) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          eyebrow="Gestão"
          title={`Editar ${paciente.nome}`}
          backTo={`/pacientes/${paciente.id}`}
          backLabel="Ficha"
          breadcrumb={[
            { label: "Pacientes", to: "/pacientes" },
            { label: paciente.nome, to: `/pacientes/${paciente.id}` },
            { label: "Editar" },
          ]}
          subtitle={`${paciente.codigo} · alterações ficam registradas na trilha de auditoria`}
        />

        {semEdicao ? (
          <BackendPendente titulo="Edição de ficha" motivo={semEdicao} />
        ) : (
        <PacienteForm
          modo="edicao"
          valoresIniciais={paraFormulario(paciente)}
          contatoAtual={{
            telefone: paciente.telefone_mascarado,
            email: paciente.email_mascarado,
          }}
          salvando={atualizar.isPending}
          onCancelar={sairDaEdicao}
          onSubmit={(valores) => {
            // CPF, telefone e e-mail chegam ao formulário mascarados. Enviar o
            // que está na tela sobrescreveria o dado real por uma máscara — por
            // isso o payload lista o que a edição realmente altera.
            const entrada = paraEntrada(valores);

            atualizar.mutate(
              {
                nome: entrada.nome,
                nascimento: entrada.nascimento,
                sexo: entrada.sexo,
                cid: entrada.cid,
                protocolo_id: entrada.protocolo_id,
                fase: entrada.fase,
                risco: entrada.risco,
                estadiamento: entrada.estadiamento,
                diagnostico_em: entrada.diagnostico_em,
                alergias: entrada.alergias,
                reacoes_previas: entrada.reacoes_previas,
                observacoes: entrada.observacoes,
                medico_responsavel_id: entrada.medico_responsavel_id,
                // Contato só entra no payload quando foi realmente digitado.
                ...(valores.telefone ? { telefone: entrada.telefone } : {}),
                ...(valores.email ? { email: entrada.email } : {}),
              },
              { onSuccess: sairDaEdicao },
            );
          }}
        />
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------ leitura */

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Gestão"
        title={paciente.nome}
        backTo="/pacientes"
        backLabel="Pacientes"
        breadcrumb={[{ label: "Pacientes", to: "/pacientes" }, { label: paciente.nome }]}
        badge={
          <StatusBadge tone={TONE_PATIENT_STATUS[paciente.status]} size="sm" dot>
            {STATUS_PACIENTE_LABEL[paciente.status]}
          </StatusBadge>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="tabular-nums">{paciente.codigo}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{ageInYears(paciente.nascimento)} anos</span>
            <span aria-hidden="true">·</span>
            <span>CPF</span>
            <CampoSensivel
              pacienteId={paciente.id}
              campo="cpf"
              mascarado={paciente.cpf_mascarado}
              nomePaciente={paciente.nome}
            />
          </span>
        }
        actions={
          <>
            <Can permission={PERMISSAO.PACIENTES_WRITE}>
              <Button
                variant="outline"
                disabled={inativo || convite.isPending || semConvite !== null}
                title={semConvite ?? undefined}
                onClick={() => convite.mutate(paciente.id)}
              >
                <MessageSquareShare />
                {paciente.convite_status === "nao_enviado" ? "Enviar convite" : "Reenviar convite"}
              </Button>

              <Button
                disabled={inativo || semEdicao !== null}
                title={semEdicao ?? undefined}
                onClick={() => setSearchParams({ editar: "1" }, { replace: true })}
              >
                <SquarePen />
                Editar
              </Button>
            </Can>

            <Can permission={PERMISSAO.PACIENTES_DEACTIVATE}>
              <Button
                variant="outline"
                disabled={inativo || semDesativar !== null}
                title={semDesativar ?? undefined}
                onClick={() => setConfirmando(true)}
                className="text-destructive hover:text-destructive"
              >
                <Ban />
                Desativar
              </Button>
            </Can>
          </>
        }
      />

      {inativo && (
        <Alert variant="destructive" role="status">
          <TriangleAlert />
          <AlertTitle>Paciente inativo</AlertTitle>
          <AlertDescription>
            Desativado em {formatDateTime(paciente.desativado_em)}
            {paciente.motivo_desativacao ? ` · ${paciente.motivo_desativacao}` : ""}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
        <DetailSection titulo="Identificação" icone={<User size={15} />}>
          <div className="flex items-center gap-3">
            <UserAvatar name={paciente.nome} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{paciente.nome}</p>
              <p className="text-muted-foreground text-xs capitalize">{paciente.sexo ?? "—"}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4">
            <DetailField rotulo="Nascimento">
              <span className="tabular-nums">{formatDate(paciente.nascimento)}</span>
            </DetailField>

            <DetailField rotulo="CPF">
              <CampoSensivel
                pacienteId={paciente.id}
                campo="cpf"
                mascarado={paciente.cpf_mascarado}
                nomePaciente={paciente.nome}
              />
            </DetailField>

            <DetailField rotulo="Telefone">
              <CampoSensivel
                pacienteId={paciente.id}
                campo="telefone"
                mascarado={paciente.telefone_mascarado}
                nomePaciente={paciente.nome}
              />
            </DetailField>

            <DetailField rotulo="E-mail">
              <CampoSensivel
                pacienteId={paciente.id}
                campo="email"
                mascarado={paciente.email_mascarado}
                nomePaciente={paciente.nome}
              />
            </DetailField>
          </dl>
        </DetailSection>

        <DetailSection titulo="Diagnóstico e tratamento" icone={<Stethoscope size={15} />}>
          <dl className="grid grid-cols-2 gap-4">
            <DetailField rotulo="CID-10">
              <span className="tabular-nums">{paciente.cid}</span>
              <p className="text-muted-foreground text-xs">{paciente.cid_descricao}</p>
            </DetailField>

            <DetailField rotulo="Estadiamento">{paciente.estadiamento ?? "—"}</DetailField>

            <DetailField rotulo="Fase">
              <span className="capitalize">
                {paciente.fase ? FASE_TRATAMENTO_LABEL[paciente.fase] : "—"}
              </span>
            </DetailField>

            <DetailField rotulo="Risco">
              {paciente.risco ? (
                <StatusBadge tone={TONE_RISK[paciente.risco]} size="sm">
                  {RISCO_LABEL[paciente.risco]}
                </StatusBadge>
              ) : (
                "—"
              )}
            </DetailField>

            <DetailField rotulo="Diagnóstico em">
              <span className="tabular-nums">{formatDate(paciente.diagnostico_em)}</span>
            </DetailField>

            <DetailField rotulo="Médico responsável">{paciente.medico_responsavel_nome ?? "—"}</DetailField>

            <div className="col-span-2">
              <DetailField rotulo="Protocolo">
                {paciente.protocolo ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-medium">{paciente.protocolo.nome}</span>
                    <p className="text-muted-foreground text-xs">
                      {paciente.protocolo.medicamentos.join(" · ")} · via{" "}
                      {paciente.protocolo.via} ·{" "}
                      {paciente.protocolo.ciclos
                        ? `${paciente.protocolo.ciclos} ciclos`
                        : "uso contínuo"}
                    </p>
                  </div>
                ) : (
                  "—"
                )}
              </DetailField>
            </div>
          </dl>
        </DetailSection>

        <DetailSection titulo="Alergias e reações prévias" icone={<CalendarDays size={15} />}>
          <dl className="flex flex-col gap-4">
            <DetailField rotulo="Alergias">
              {paciente.alergias.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {paciente.alergias.map((alergia) => (
                    <li key={alergia}>
                      <StatusBadge tone="warning" size="sm">
                        {alergia}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground text-sm">Nenhuma registrada</span>
              )}
            </DetailField>

            <DetailField rotulo="Reações prévias">
              {paciente.reacoes_previas.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {paciente.reacoes_previas.map((reacao) => (
                    <li key={reacao}>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {reacao}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground text-sm">Nenhuma registrada</span>
              )}
            </DetailField>

            {paciente.observacoes && (
              <DetailField rotulo="Observações">
                <p className="text-sm leading-relaxed">{paciente.observacoes}</p>
              </DetailField>
            )}
          </dl>
        </DetailSection>

        <DetailSection titulo="Acesso ao aplicativo" icone={<Smartphone size={15} />}>
          <dl className="grid grid-cols-2 gap-4">
            <DetailField rotulo="Convite">{STATUS_CONVITE_LABEL[paciente.convite_status]}</DetailField>

            <DetailField rotulo="Enviado em">
              <span className="tabular-nums">{formatDateTime(paciente.convite_enviado_em)}</span>
            </DetailField>

            <DetailField rotulo="Último acesso">
              {paciente.ultimo_acesso_app_em ? relativeTime(paciente.ultimo_acesso_app_em) : "Nunca acessou"}
            </DetailField>

            <DetailField rotulo="Cadastrado em">
              <span className="tabular-nums">{formatDate(paciente.criado_em)}</span>
            </DetailField>
          </dl>
        </DetailSection>
      </div>

      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        title={`Desativar ${paciente.nome}?`}
        description="A ficha continua no sistema e o histórico é preservado, mas o paciente deixa de aparecer como ativo e perde o acesso ao aplicativo."
        confirmLabel="Desativar"
        requireReason
        loading={desativar.isPending}
        onConfirm={({ reason }) => {
          desativar.mutate({ id: paciente.id, motivo: reason }, { onSuccess: () => navigate("/pacientes") });
          setConfirmando(false);
        }}
      />
    </div>
  );
}

export default PacienteFichaPage;
