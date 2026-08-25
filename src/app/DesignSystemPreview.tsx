import { Activity, Bell, Download, Moon, Plus, Sun, TriangleAlert, UserRound, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  BarChart,
  ConfirmDialog,
  DataTable,
  DonutChart,
  EmptyState,
  ErrorState,
  LineChart,
  Loading,
  PageHeader,
  SearchInput,
  StatCard,
  StatusBadge,
  UserAvatar,
  AvatarGroup,
  type Column,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { maskCpf } from "@/lib/mask";
import { ERROR_CODE, type Sort } from "@/services/contracts";
import { useThemeStore } from "@/stores/theme";

/**
 * GALERIA DO DESIGN SYSTEM — Fase 1.
 *
 * Ferramenta interna: mostra todos os componentes nos dois temas, sem depender
 * de nenhuma tela real estar pronta. Vai para a rota `/design-system` na Fase 3.
 *
 * Os dados abaixo são ilustrativos. Dado de verdade só chega pelo `apiClient`.
 */

interface PacienteExemplo {
  id: string;
  nome: string;
  ageInYears: number;
  cpf: string;
  cid: string;
  protocolo: string;
  fase: "ativo" | "seguimento" | "manutencao";
}

const PACIENTES: PacienteExemplo[] = [
  { id: "1", nome: "Maria Aparecida Souza", ageInYears: 62, cpf: "52998224412", cid: "C18.9", protocolo: "FOLFOX", fase: "ativo" },
  { id: "2", nome: "João Carlos Meneghel", ageInYears: 58, cpf: "11144477735", cid: "C20", protocolo: "CAPOX", fase: "seguimento" },
  { id: "3", nome: "Rita de Cássia Prado", ageInYears: 47, cpf: "39053344705", cid: "C81.9", protocolo: "ABVD", fase: "manutencao" },
];

const SERIE_MESES = [
  { mes: "Fev", sessoes: 182, faltas: 12 },
  { mes: "Mar", sessoes: 204, faltas: 9 },
  { mes: "Abr", sessoes: 196, faltas: 14 },
  { mes: "Mai", sessoes: 231, faltas: 8 },
  { mes: "Jun", sessoes: 219, faltas: 11 },
  { mes: "Jul", sessoes: 248, faltas: 7 },
];

const DISTRIBUICAO_CID = [
  { name: "C18.9", value: 24 },
  { name: "C50.9", value: 19 },
  { name: "C34.9", value: 15 },
  { name: "C20", value: 12 },
  { name: "Outros", value: 11 },
];

const EQUIPE = [
  { id: "a", name: "Ana Beatriz Rocha" },
  { id: "b", name: "Carlos Eduardo Lima" },
  { id: "c", name: "Letícia Mafra" },
  { id: "d", name: "Rafael dos Santos" },
  { id: "e", name: "Camila Souza" },
  { id: "f", name: "Pedro Henrique Alves" },
];

const TONE_FASE_EXEMPLO = {
  ativo: "success",
  seguimento: "info",
  manutencao: "primary",
} as const;

const COLUNAS: Column<PacienteExemplo>[] = [
  {
    key: "nome",
    header: "Paciente",
    sortable: true,
    render: (row) => (
      <div className="flex items-center gap-3">
        <UserAvatar name={row.nome} size="sm" colorful />
        <div className="flex flex-col">
          <span className="font-medium">{row.nome}</span>
          <span className="text-muted-foreground text-xs">
            {row.ageInYears} anos · <span className="font-mono">{maskCpf(row.cpf)}</span>
          </span>
        </div>
      </div>
    ),
  },
  { key: "cid", header: "CID", mono: true, width: 90, sortable: true },
  { key: "protocolo", header: "Protocolo", width: 130 },
  {
    key: "fase",
    header: "Fase",
    width: 130,
    render: (row) => (
      <StatusBadge tone={TONE_FASE_EXEMPLO[row.fase]} dot>
        {row.fase}
      </StatusBadge>
    ),
  },
];

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-muted-foreground border-border border-b pb-2 text-xs font-semibold tracking-wide uppercase">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export function DesignSystemPreview() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [confirmAberto, setConfirmAberto] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [ordenacao, setOrdenacao] = useState<Sort>({ field: "nome", direction: "asc" });
  const [notificar, setNotificar] = useState(true);

  return (
    <div>
      <div className="flex flex-col gap-10">
        <header className="border-border flex items-start justify-between gap-6 border-b pb-6">
          <div>
            <span className="text-primary inline-flex items-center gap-2 font-mono text-xs font-medium tracking-wide uppercase">
              <Activity size={14} aria-hidden="true" />
              Fase 1 · Design System
            </span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Jornada Supera · Componentes
            </h1>
            <p className="text-muted-foreground mt-2 max-w-[60ch]">
              Primitivos do shadcn/ui com os tokens do protótipo, mais as composições do painel.
              Alterne o tema para conferir contraste e legibilidade antes de usar em qualquer tela.
            </p>
          </div>

          <Button variant="outline" onClick={toggleTheme}>
            {theme === "dark" ? <Moon /> : <Sun />}
            Tema: {theme}
          </Button>
        </header>

        {/* ---------------------------------------------------------- botões */}
        <Secao titulo="Botões">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="outline">Contorno</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button variant="destructive">Destrutivo</Button>
            <Button variant="link">Link</Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">
              <Plus />
              Pequeno
            </Button>
            <Button>
              <Plus />
              Novo paciente
            </Button>
            <Button size="lg" variant="outline">
              <Download />
              Exportar CSV
            </Button>
            <Button disabled>Desabilitado</Button>
            <Button variant="outline" size="icon" aria-label="Notificações">
              <Bell />
            </Button>
          </div>
        </Secao>

        {/* ------------------------------------------------------ formulário */}
        <Secao titulo="Formulário">
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ds-nome">
                Nome completo
                <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input id="ds-nome" placeholder="Maria Aparecida Souza" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ds-cpf">CPF</Label>
              <Input id="ds-cpf" inputMode="numeric" placeholder="000.000.000-00" className="font-mono" />
              <p className="text-muted-foreground text-xs">Somente números.</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ds-registro">Registro profissional</Label>
              <Input
                id="ds-registro"
                defaultValue="CRM 00000"
                aria-invalid
                aria-describedby="ds-registro-erro"
                className="font-mono"
              />
              <p id="ds-registro-erro" role="alert" className="text-destructive text-xs">
                Registro não confere com a especialidade.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ds-especialidade">Especialidade</Label>
              <Select>
                <SelectTrigger id="ds-especialidade" className="w-full">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medico_oncologista">Médico Oncologista</SelectItem>
                  <SelectItem value="farmaceutico">Farmacêutico</SelectItem>
                  <SelectItem value="enfermeiro">Enfermeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="ds-obs">Observações</Label>
              <Textarea id="ds-obs" rows={3} placeholder="Anotações internas" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome, CPF ou código" />

            <Label className="flex items-center gap-3 font-normal">
              <Checkbox />
              Incluir pacientes inativos
            </Label>

            <Label className="flex items-center gap-3 font-normal">
              <Switch checked={notificar} onCheckedChange={setNotificar} />
              Notificar equipe
            </Label>
          </div>
        </Secao>

        {/* --------------------------------------------- status e identidade */}
        <Secao titulo="Status, categorias e pessoas">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge tone="success" dot>Ativo</StatusBadge>
            <StatusBadge tone="warning" dot>Pausado</StatusBadge>
            <StatusBadge tone="danger" dot>Crítico</StatusBadge>
            <StatusBadge tone="info">Em revisão</StatusBadge>
            <StatusBadge tone="primary">Sigiloso</StatusBadge>
            <StatusBadge tone="neutral">Rascunho</StatusBadge>
            <StatusBadge tone="success" pill size="sm">MVP</StatusBadge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <UserAvatar name="Ana Beatriz Rocha" size="xs" colorful />
            <UserAvatar name="Carlos Eduardo Lima" size="sm" colorful />
            <UserAvatar name="Letícia Mafra" size="md" colorful />
            <UserAvatar name="Rafael dos Santos" size="lg" colorful />
            <AvatarGroup people={EQUIPE} max={4} />
          </div>
        </Secao>

        {/* ------------------------------------------------------------ KPIs */}
        <Secao titulo="Indicadores">
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
            <StatCard
              label="Pacientes ativos"
              value="81"
              delta={6.4}
              period="vs. mês anterior"
              icon={<Users size={16} />}
              onClick={() => toast.info("Drill-down abriria o relatório de pacientes ativos")}
            />
            <StatCard
              label="Novos no mês"
              value="14"
              delta={-8.2}
              period="vs. mês anterior"
              icon={<UserRound size={16} />}
            />
            <StatCard
              label="Tempo médio de resposta"
              value="7"
              unit="min"
              delta={-18.5}
              period="vs. semana anterior"
              invertColor
              icon={<Activity size={16} />}
            />
            <StatCard label="Alertas pendentes" loading />
          </div>
        </Secao>

        {/* -------------------------------------------------------- gráficos */}
        <Secao titulo="Gráficos">
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
            <Card>
              <CardHeader>
                <CardTitle>Sessões de quimioterapia</CardTitle>
                <CardDescription>Últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={SERIE_MESES}
                  xKey="mes"
                  series={[
                    { key: "sessoes", label: "Sessões" },
                    { key: "faltas", label: "Faltas" },
                  ]}
                  legend
                  height={240}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pacientes por CID</CardTitle>
                <CardDescription>Distribuição atual</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChart data={DISTRIBUICAO_CID} totalLabel="pacientes" height={240} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Engajamento no app</CardTitle>
                <CardDescription>Evolução semanal</CardDescription>
              </CardHeader>
              <CardContent>
                <LineChart
                  data={SERIE_MESES}
                  xKey="mes"
                  series={[{ key: "sessoes", label: "Acessos" }]}
                  height={200}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sem dados</CardTitle>
                <CardDescription>Estado vazio do gráfico</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChart data={[]} height={200} />
              </CardContent>
            </Card>
          </div>
        </Secao>

        {/* ---------------------------------------------------------- tabela */}
        <Secao titulo="Tabela">
          <PageHeader
            title="Pacientes"
            subtitle="81 pacientes cadastrados · convite por SMS no cadastro"
            badge={<StatusBadge tone="success" pill size="sm">MVP</StatusBadge>}
            actions={
              <Button>
                <Plus />
                Novo paciente
              </Button>
            }
          />

          <Tabs value={aba} onValueChange={setAba}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="ativos">Em tratamento</TabsTrigger>
              <TabsTrigger value="seguimento">Seguimento</TabsTrigger>
              <TabsTrigger value="inativos" disabled>Inativos</TabsTrigger>
            </TabsList>
          </Tabs>

          <Card className="overflow-hidden py-0">
            <DataTable
              caption="Lista de pacientes cadastrados"
              columns={COLUNAS}
              data={PACIENTES}
              sort={ordenacao}
              onSortChange={setOrdenacao}
              selectable
              selectedIds={selecionados}
              onSelectionChange={setSelecionados}
              bulkActions={
                <Button size="sm" variant="outline">
                  <Download />
                  Exportar selecionados
                </Button>
              }
              label="pacientes"
              pagination={{
                page: 1,
                pageSize: 20,
                count: 81,
                onPageChange: () => {},
                onPageSizeChange: () => {},
              }}
            />
          </Card>
        </Secao>

        {/* --------------------------------------------------------- estados */}
        <Secao titulo="Estados obrigatórios">
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
            <Card>
              <CardHeader><CardTitle>Carregando</CardTitle></CardHeader>
              <Loading compact />
            </Card>

            <Card>
              <CardHeader><CardTitle>Vazio</CardTitle></CardHeader>
              <EmptyState compact action={<Button size="sm">Novo paciente</Button>} />
            </Card>

            <Card>
              <CardHeader><CardTitle>Busca sem resultado</CardTitle></CardHeader>
              <EmptyState variant="search" compact />
            </Card>

            <Card>
              <CardHeader><CardTitle>Sem permissão</CardTitle></CardHeader>
              <ErrorState variant="forbidden" compact />
            </Card>

            <Card>
              <CardHeader><CardTitle>Erro de rede</CardTitle></CardHeader>
              <ErrorState
                error={{ code: ERROR_CODE.NETWORK }}
                onRetry={() => toast.info("Refazendo a consulta…")}
                compact
              />
            </Card>

            <Card>
              <CardHeader><CardTitle>Ainda não implementado</CardTitle></CardHeader>
              <ErrorState error={{ code: ERROR_CODE.NOT_IMPLEMENTED }} compact />
            </Card>
          </div>
        </Secao>

        {/* -------------------------------------------------------- feedback */}
        <Secao titulo="Avisos e diálogos">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => toast.success("Paciente cadastrado")}>
              Sucesso
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.error("Não foi possível salvar", {
                  description: "O registro profissional informado já está em uso.",
                })
              }
            >
              Erro
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.warning("Sessão expira em 2 minutos", {
                  action: {
                    label: "Continuar conectada",
                    onClick: () => toast.success("Sessão renovada"),
                  },
                })
              }
            >
              Aviso com ação
            </Button>
            <Button variant="outline" onClick={() => setModalAberto(true)}>
              Abrir modal
            </Button>
            <Button variant="destructive" onClick={() => setConfirmAberto(true)}>
              <TriangleAlert />
              Desativar paciente
            </Button>
          </div>
        </Secao>

        <p className="text-muted-foreground border-border border-t py-5 pb-12 text-xs">
          Fase 1 concluída · próxima: Fase 2 — Autenticação, MFA e RBAC. Esta galeria continua
          disponível durante todo o projeto para conferência visual.
        </p>
      </div>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convite por SMS</DialogTitle>
            <DialogDescription>
              O paciente recebe um link para ativar o aplicativo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-telefone">Telefone</Label>
            <Input id="ds-telefone" defaultValue="(48) 9****-**21" className="font-mono" />
            <p className="text-muted-foreground text-xs">O convite é enviado para este número.</p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setModalAberto(false);
                toast.success("Convite enviado por SMS");
              }}
            >
              Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmAberto}
        onOpenChange={setConfirmAberto}
        onConfirm={({ reason }) => {
          setConfirmAberto(false);
          toast.success("Paciente desativado", { description: `Motivo registrado: ${reason}` });
        }}
        title="Desativar paciente?"
        description="O paciente perde o acesso ao aplicativo. O histórico é preservado e a ação fica registrada na trilha de auditoria."
        confirmLabel="Desativar"
        requireReason
      />
    </div>
  );
}

export default DesignSystemPreview;
