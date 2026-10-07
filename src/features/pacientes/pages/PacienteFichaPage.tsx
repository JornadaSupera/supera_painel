import {
  Ban,
  CalendarDays,
  ChevronLeft,
  MessageSquareShare,
  Smartphone,
  SquarePen,
  Stethoscope,
  TriangleAlert,
  User,
  UsersRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  BackendPendente,
  Can,
  ConfirmDialog,
  DetailField,
  DetailSection,
  ErrorState,
  PageHeader,
  ScrollableTabsList,
  SkeletonForm,
  StatusBadge,
  TONE_RISK,
  TONE_PATIENT_STATUS,
  UserAvatar,
} from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import {
  FASE_TRATAMENTO_LABEL,
  RISCO_LABEL,
  STATUS_PACIENTE,
  STATUS_PACIENTE_LABEL,
} from "@/lib/enums";
import { formatDate, formatDateTime, ageInYears } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import type { PacienteDetalhe, ResultadoConvite } from "@/types/paciente";
import { AppAccessDetails } from "../components/AppAccessDetails";
import { CampoSensivel } from "../components/CampoSensivel";
import { CuidadoresVinculados } from "../components/CuidadoresVinculados";
import { ConviteEmitidoDialog } from "../components/ConviteEmitidoDialog";
import { DeactivatePatientDialog } from "../components/DeactivatePatientDialog";
import { OtherDiagnosesList } from "../components/DiagnosisDetails";
import { OrigemDosDados } from "../components/OrigemDosDados";
import { PatientGeneralTab } from "../components/PatientGeneralTab";
import { PatientRecordHeader } from "../components/PatientRecordHeader";
import { motivoIndisponivel } from "@/services/apiClient";
import { PacienteForm } from "../components/PacienteForm";
import { protocolDetails } from "../protocol";
import {
  useAtualizarPaciente,
  useDesvincularConta,
  useEnviarConvite,
  usePaciente,
} from "../hooks/usePacientes";
import { paraClinica, paraEntrada, VALORES_INICIAIS, type PacienteForm as Valores } from "../schemas";

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
    alergias: paciente.alergias,
    reacoes_previas: paciente.reacoes_previas,
    // Quadro clínico: aqui o campo começa PREENCHIDO, ao contrário do contato.
    // A diferença é o que o vazio significa dos dois lados — contato vazio
    // mantém o atual porque o valor chega mascarado; quadro clínico vazio
    // também mantém, mas quem edita precisa VER o que está gravado para saber
    // que está trocando um protocolo, e não iniciando um.
    cid: paciente.cid,
    estadiamento: paciente.estadiamento ?? "",
    tnm: paciente.tnm ?? "",
    diagnostico_em: paciente.diagnostico_em?.slice(0, 10) ?? "",
    protocolo_nome: paciente.protocolo?.nome ?? "",
    ciclos_previstos: paciente.protocolo?.ciclos ? String(paciente.protocolo.ciclos) : "",
    intencao: paciente.intencao_terapeutica ?? "",
    plano_iniciado_em: paciente.plano_iniciado_em?.slice(0, 10) ?? "",
    fase: paciente.fase ?? "",
    convenio: paciente.convenio ?? "",
    // Contato começa vazio: vazio significa "manter o atual". Ver
    // `pacienteEdicaoSchema`.
    telefone: "",
    email: "",
    enviar_convite: false,
  };
}

/* -------------------------------------------------------------- tela */

/** A tab the embedding panel adds after "Geral". */
export interface RecordTab {
  /** Goes in the address (`?aba=diario`), so it stays plain and lowercase. */
  value: string;
  label: ReactNode;
  content: ReactNode;
}

/** The first tab is the record's own; its value is never written to the address. */
const GENERAL_TAB = "geral";
const TAB_PARAM = "aba";

export interface PacienteFichaPageProps {
  /**
   * Where the patient list lives, for the links that lead back to it. The
   * clinical panel mounts the same record inside its own frame, so the way
   * back must stay there instead of landing in the administrative one.
   */
  basePath?: string;
  /** Small label above the title. */
  eyebrow?: string;
  /**
   * Buttons that belong to the panel embedding the record, ahead of the ones the
   * record owns. A function, because some need the patient that only loads here.
   */
  actions?: (paciente: PacienteDetalhe) => ReactNode;
  /**
   * With tabs, the record is read as the clinical panel's: a header card on top
   * and "Geral" plus these tabs below. Without them it stays one page of cards,
   * which is how the administration reads it.
   */
  tabs?: RecordTab[];
}

export function PacienteFichaPage({
  basePath = "/pacientes",
  eyebrow = "Gestão",
  actions,
  tabs,
}: PacienteFichaPageProps = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmando, setConfirmando] = useState(false);

  const [desvinculando, setDesvinculando] = useState(false);

  const { data: paciente, isLoading, isError, error, refetch } = usePaciente(id);
  const atualizar = useAtualizarPaciente(id ?? "");
  const convite = useEnviarConvite();
  const desvincular = useDesvincularConta();
  const [conviteEmitido, setConviteEmitido] = useState<ResultadoConvite | null>(null);

  const editando = searchParams.get("editar") === "1";

  // An unknown value in the address — an old link, a typo — opens "Geral".
  const requestedTab = searchParams.get(TAB_PARAM);
  const activeTab =
    requestedTab && tabs?.some((tab) => tab.value === requestedTab) ? requestedTab : GENERAL_TAB;
  const openTab = (value: string) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === GENERAL_TAB) next.delete(TAB_PARAM);
        else next.set(TAB_PARAM, value);
        return next;
      },
      { replace: true },
    );

  const semEdicao = motivoIndisponivel("pacientes.update");
  const semConvite = motivoIndisponivel("pacientes.sendInvite");
  const semDesativar = motivoIndisponivel("pacientes.deactivate");
  const sairDaEdicao = () => setSearchParams({}, { replace: true });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader eyebrow={eyebrow} title="Ficha do paciente" />
        <SkeletonForm fields={8} className="max-w-3xl" />
      </div>
    );
  }

  if (isError || !paciente) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const inativo = paciente.status === STATUS_PACIENTE.INATIVO;
  const outrosDiagnosticos = paciente.diagnosticos.filter((diagnostico) => !diagnostico.principal);

  /* ------------------------------------------------------------ edição */

  if (editando) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          eyebrow={eyebrow}
          title={`Editar ${paciente.nome}`}
          backTo={`${basePath}/${paciente.id}`}
          backLabel="Ficha"
          breadcrumb={[
            { label: "Pacientes", to: basePath },
            { label: paciente.nome, to: `${basePath}/${paciente.id}` },
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
          diagnosticosRegistrados={outrosDiagnosticos}
          salvando={atualizar.isPending}
          onCancelar={sairDaEdicao}
          onSubmit={(valores) => {
            // CPF, telefone e e-mail chegam ao formulário mascarados. Enviar o
            // que está na tela sobrescreveria o dado real por uma máscara — por
            // isso o payload lista o que a edição realmente altera.
            const entrada = paraEntrada(valores);

            atualizar.mutate(
              {
                dados: {
                  nome: entrada.nome,
                  nascimento: entrada.nascimento,
                  convenio: entrada.convenio,
                  // Só cresce: o que saiu da lista não é apagado, porque o
                  // histórico clínico é imutável do lado do banco.
                  alergias: entrada.alergias,
                  reacoes_previas: entrada.reacoes_previas,
                  // Contato só entra no payload quando foi realmente digitado.
                  ...(valores.telefone ? { telefone: entrada.telefone } : {}),
                  ...(valores.email ? { email: entrada.email } : {}),
                },
                // O adapter compara com o que está gravado e só escreve a
                // diferença — mandar a etapa inteira aqui é seguro.
                clinica: paraClinica(valores),
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

  const recordActions = (
    <>
      {actions?.(paciente)}
      <Can permission={PERMISSAO.PACIENTES_WRITE}>
        <Button
          variant="outline"
          disabled={inativo || convite.isPending || semConvite !== null}
          title={semConvite ?? undefined}
          onClick={() =>
            convite.mutate(paciente.id, {
              // O código sai uma vez só. O diálogo é o que dá a quem
              // emitiu a chance de anotá-lo antes de ele sumir.
              onSuccess: (resultado) => setConviteEmitido(resultado ?? null),
            })
          }
        >
          <MessageSquareShare />
          {paciente.convite_status === "nao_enviado" ? "Emitir convite" : "Reemitir convite"}
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
  );

  const inactiveNotice = inativo && (
    <Alert variant="destructive" role="status">
      <TriangleAlert />
      <AlertTitle>Paciente inativo</AlertTitle>
      <AlertDescription>
        Desativado em {formatDateTime(paciente.desativado_em)}
        {paciente.motivo_desativacao ? ` · ${paciente.motivo_desativacao}` : ""}
      </AlertDescription>
    </Alert>
  );

  const dialogs = (
    <>
      <DeactivatePatientDialog
        paciente={paciente}
        open={confirmando}
        onOpenChange={setConfirmando}
        onDeactivated={() => navigate(basePath)}
      />

      {/* O que fica é o que precisa ser dito: a preocupação de quem clica é o
          que se perde, e aqui não se perde ficha nem histórico. */}
      <ConfirmDialog
        open={desvinculando}
        onOpenChange={setDesvinculando}
        tone="warning"
        title="Desfazer o vínculo com a conta?"
        description={`A ficha de ${paciente.nome}, o histórico e a conta continuam existindo — o que se desfaz é a ligação entre a ficha e o aplicativo. ${paciente.nome} deixa de ver esta ficha no app até aceitar um convite novo.`}
        confirmLabel="Desfazer vínculo"
        loading={desvincular.isPending}
        onConfirm={({ reason }) => {
          desvincular.mutate({ id: paciente.id, motivo: reason });
          setDesvinculando(false);
        }}
      />

      <ConviteEmitidoDialog convite={conviteEmitido} onClose={() => setConviteEmitido(null)} />
    </>
  );

  /* ------------------------------------------------------- leitura em abas */

  // The header card holds the name, so there is no page title above it — only
  // the way back. Full width: the layout already caps the content, and with the
  // actions inside the card they stay framed with the record they act on. Each
  // tab mounts when opened: the clinical ones read audited sources, and a tab
  // nobody opens should not leave a read in the trail.
  if (tabs) {
    return (
      <div className="flex flex-col gap-5">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-muted-foreground hover:text-foreground -ml-2 h-10 w-fit gap-1 px-2 md:h-7"
        >
          <Link to={basePath}>
            <ChevronLeft size={14} aria-hidden="true" />
            Voltar à lista
          </Link>
        </Button>

        <PatientRecordHeader paciente={paciente} actions={recordActions} />

        {inactiveNotice}

        <Tabs value={activeTab} onValueChange={openTab} className="gap-4">
          <ScrollableTabsList aria-label="Seções da ficha">
            <TabsTrigger value={GENERAL_TAB}>Geral</TabsTrigger>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </ScrollableTabsList>

          <TabsContent value={GENERAL_TAB}>
            <PatientGeneralTab
              paciente={paciente}
              onUnlink={() => setDesvinculando(true)}
              unlinking={desvincular.isPending}
            />
          </TabsContent>

          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>

        {dialogs}
      </div>
    );
  }

  /* ------------------------------------------------- leitura administrativa */

  // Header and cards share one width. With only the cards capped, a wide
  // monitor put Editar and Desativar ~1500px from the record they act on.
  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageHeader
        eyebrow={eyebrow}
        title={paciente.nome}
        backTo={basePath}
        backLabel="Pacientes"
        breadcrumb={[{ label: "Pacientes", to: basePath }, { label: paciente.nome }]}
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
        actions={recordActions}
      />

      {inactiveNotice}

      <OrigemDosDados paciente={paciente} />

      <div className="grid gap-4 md:grid-cols-2">
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
            <DetailField rotulo={outrosDiagnosticos.length > 0 ? "Diagnóstico principal" : "CID-10"}>
              <span className="tabular-nums">{paciente.cid}</span>
              <p className="text-muted-foreground text-xs">{paciente.cid_descricao}</p>
            </DetailField>

            <DetailField rotulo="Estadiamento">
              {paciente.estadiamento ?? "—"}
              {paciente.tnm && (
                <p className="text-muted-foreground font-mono text-xs">{paciente.tnm}</p>
              )}
            </DetailField>

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

            {outrosDiagnosticos.length > 0 && (
              <div className="col-span-2">
                <DetailField rotulo="Outros diagnósticos">
                  <OtherDiagnosesList diagnoses={outrosDiagnosticos} />
                </DetailField>
              </div>
            )}

            <div className="col-span-2">
              <DetailField rotulo="Protocolo">
                {paciente.protocolo ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-medium">{paciente.protocolo.nome}</span>
                    <p className="text-muted-foreground text-xs">{protocolDetails(paciente)}</p>
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
                      <Badge variant="secondary" className="text-[11px] font-normal">
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
          <AppAccessDetails
            paciente={paciente}
            onUnlink={() => setDesvinculando(true)}
            unlinking={desvincular.isPending}
          />
        </DetailSection>

        {/* Dado pessoal de terceiro dentro da ficha: aparece porque o
            encarregado de dados pergunta por ele, mascarado porque o painel
            não precisa do contato. */}
        <DetailSection titulo="Acompanhantes" icone={<UsersRound size={15} />}>
          <CuidadoresVinculados pacienteId={paciente.id} />
        </DetailSection>
      </div>

      {dialogs}
    </div>
  );
}

export default PacienteFichaPage;
