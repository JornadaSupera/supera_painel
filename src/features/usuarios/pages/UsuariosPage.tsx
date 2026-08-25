import { FilterX, UserPlus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Can,
  DataTable,
  EmptyState,
  PageHeader,
  SearchInput,
  StatusBadge,
  TONE_USER_STATUS,
  UserAvatar,
  type Column,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import {
  ESPECIALIDADE_LABEL,
  PAPEL_LABEL,
  STATUS_USUARIO_LABEL,
  toOptions,
} from "@/lib/enums";
import { formatNumber } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import { temRecorte, useUsuariosStore } from "@/stores/usuarios";
import type { UsuarioListItem } from "@/types/usuario";
import { AcoesUsuario } from "../components/AcoesUsuario";
import { DistribuicaoEspecialidades } from "../components/DistribuicaoEspecialidades";
import { HistoricoAcessos } from "../components/HistoricoAcessos";
import { MatrizPermissoes } from "../components/MatrizPermissoes";
import { useDistribuicao, useUsuarios } from "../hooks/useUsuarios";

/**
 * Usuários — a equipe que opera o painel.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/usuarios/
 *
 * Cabeçalho, faixa de especialidades, busca e as cinco colunas são os do
 * protótipo. A aba "Permissões" é exigência do escopo contratado e não aparece
 * lá — fica aqui, e não numa rota nova, porque é a mesma pergunta que esta tela
 * responde: quem pode o quê.
 */

/** O <Select> do Radix reserva o valor vazio para "nada selecionado". */
const TODOS = "todos";

export function UsuariosPage() {
  const navigate = useNavigate();
  const { can } = useAuth();

  const [historicoDe, setHistoricoDe] = useState<UsuarioListItem | null>(null);

  const { usuarios, total, isLoading, isError, error, refetch } = useUsuarios();
  const distribuicao = useDistribuicao();

  const busca = useUsuariosStore((estado) => estado.busca);
  const filtros = useUsuariosStore((estado) => estado.filtros);
  const sort = useUsuariosStore((estado) => estado.sort);
  const page = useUsuariosStore((estado) => estado.page);
  const pageSize = useUsuariosStore((estado) => estado.pageSize);
  const setBusca = useUsuariosStore((estado) => estado.setBusca);
  const setFiltro = useUsuariosStore((estado) => estado.setFiltro);
  const limparFiltros = useUsuariosStore((estado) => estado.limparFiltros);
  const setSort = useUsuariosStore((estado) => estado.setSort);
  const setPage = useUsuariosStore((estado) => estado.setPage);
  const setPageSize = useUsuariosStore((estado) => estado.setPageSize);

  const filtrada = temRecorte(busca, filtros);

  /**
   * O protótipo diz "16 profissionais cadastrados · 7 especialidades", mas a
   * lista tem 18 contas: administrador e gestor operam o painel sem ocupar vaga
   * na equipe assistencial. O subtítulo separa as duas contagens em vez de
   * chamar 18 de "profissionais" ou esconder duas linhas da tabela.
   */
  const especialidades = (distribuicao.data ?? []).filter((item) => item.total > 0).length;
  const assistenciais = (distribuicao.data ?? []).reduce((soma, item) => soma + item.total, 0);

  const colunas: Column<UsuarioListItem>[] = [
    {
      key: "nome",
      header: "Profissional",
      sortable: true,
      width: "34%",
      render: (usuario) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={usuario.nome} size="sm" colorful className="shrink-0" />

          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-medium">
              {usuario.tratamento ? `${usuario.tratamento} ` : ""}
              {usuario.nome}
            </p>
            <p className="text-muted-foreground truncate text-[11px]">{usuario.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "especialidade",
      header: "Especialidade",
      sortable: true,
      width: "18%",
      render: (usuario) => (
        <span className="text-xs">
          {usuario.especialidade ? (
            ESPECIALIDADE_LABEL[usuario.especialidade]
          ) : (
            // Administrador e gestor operam o painel; não ocupam vaga na
            // equipe assistencial.
            <span className="text-muted-foreground">{PAPEL_LABEL[usuario.papel]}</span>
          )}
        </span>
      ),
    },
    {
      key: "registro",
      header: "Registro",
      width: "16%",
      render: (usuario) => (
        <span className="text-muted-foreground text-[11px] tabular-nums">
          {usuario.registro ?? "—"}
        </span>
      ),
    },
    {
      key: "horario_inicio",
      header: "Horário chat",
      width: 130,
      render: (usuario) =>
        usuario.horario_inicio && usuario.horario_fim ? (
          <span className="text-xs tabular-nums">
            {usuario.horario_inicio}–{usuario.horario_fim}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      width: 110,
      render: (usuario) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge tone={TONE_USER_STATUS[usuario.status]} size="sm" dot>
            {STATUS_USUARIO_LABEL[usuario.status]}
          </StatusBadge>

          {/* Segundo fator desligado é exceção; a lista precisa deixar isso
              visível sem exigir que se abra cada ficha. */}
          {!usuario.mfa_ativo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="bg-warning-bg text-warning-foreground border-warning/30 cursor-default rounded-sm border px-1 text-[10px] font-medium">
                  sem 2FA
                </span>
              </TooltipTrigger>
              <TooltipContent>Segundo fator desativado para esta conta.</TooltipContent>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      render: (usuario) => <AcoesUsuario usuario={usuario} onVerHistorico={setHistoricoDe} />,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Gestão"
        title="Usuários"
        level="MVP"
        subtitle={
          isLoading && total === 0
            ? "Carregando equipe…"
            : filtrada
              ? `${formatNumber(total)} usuários no recorte atual`
              : `${formatNumber(total)} usuários cadastrados · ${assistenciais} profissionais em ${especialidades} especialidades`
        }
        actions={
          <Can permission={PERMISSAO.USUARIOS_MANAGE}>
            <Button onClick={() => navigate("/usuarios/novo")}>
              <UserPlus />
              Novo usuário
            </Button>
          </Can>
        }
      />

      <Tabs defaultValue="profissionais" className="flex flex-col gap-5">
        {/* Sem permissão de editar permissões, não há segunda aba — e uma aba
            sozinha é ruído. */}
        {can(PERMISSAO.PERMISSOES_MANAGE) && (
          <TabsList>
            <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
            <TabsTrigger value="permissoes">Permissões por papel</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="profissionais" className="flex flex-col gap-5">
          <DistribuicaoEspecialidades
            distribuicao={distribuicao.data ?? []}
            carregando={distribuicao.isLoading}
          />

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar profissional…"
              label="Buscar profissional"
              className="min-w-60 flex-1"
            />

            <Select
              value={filtros.papel || TODOS}
              onValueChange={(valor) => setFiltro("papel", valor === TODOS ? "" : valor)}
            >
              <SelectTrigger size="sm" aria-label="Papel" className="w-44">
                <SelectValue placeholder="Papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Papel: todos</SelectItem>
                {toOptions(PAPEL_LABEL).map((opcao) => (
                  <SelectItem key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filtros.status || TODOS}
              onValueChange={(valor) => setFiltro("status", valor === TODOS ? "" : valor)}
            >
              <SelectTrigger size="sm" aria-label="Status" className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Status: todos</SelectItem>
                {toOptions(STATUS_USUARIO_LABEL).map((opcao) => (
                  <SelectItem key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {filtrada && (
              <Button variant="ghost" size="sm" onClick={limparFiltros}>
                <FilterX />
                Limpar
              </Button>
            )}
          </div>

          <div className="bg-card overflow-hidden rounded-2xl border">
            <DataTable
              columns={colunas}
              data={usuarios}
              caption="Profissionais cadastrados, com especialidade, registro no conselho, horário de atendimento no chat e status."
              label="profissionais"
              loading={isLoading}
              error={isError ? error : null}
              onRetry={() => void refetch()}
              sort={sort}
              onSortChange={setSort}
              filtered={filtrada}
              onRowClick={
                can(PERMISSAO.USUARIOS_MANAGE)
                  ? (usuario) => navigate(`/usuarios/${usuario.id}`)
                  : undefined
              }
              pagination={{
                page,
                pageSize,
                count: total,
                onPageChange: setPage,
                onPageSizeChange: setPageSize,
              }}
              emptyState={
                <EmptyState
                  variant={filtrada ? "search" : "empty"}
                  title={
                    filtrada ? "Nenhum profissional no recorte" : "Nenhum profissional cadastrado"
                  }
                  description={
                    filtrada
                      ? "Nenhum cadastro corresponde à busca e aos filtros aplicados."
                      : "Cadastre a equipe para liberar o acesso ao painel e ao chat com pacientes."
                  }
                  action={
                    <Can permission={PERMISSAO.USUARIOS_MANAGE}>
                      <Button onClick={() => navigate("/usuarios/novo")}>
                        <UserPlus />
                        Novo usuário
                      </Button>
                    </Can>
                  }
                />
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="permissoes">
          <MatrizPermissoes />
        </TabsContent>
      </Tabs>

      <HistoricoAcessos
        usuario={historicoDe}
        aberto={historicoDe !== null}
        onOpenChange={(aberto) => !aberto && setHistoricoDe(null)}
      />
    </div>
  );
}

export default UsuariosPage;
