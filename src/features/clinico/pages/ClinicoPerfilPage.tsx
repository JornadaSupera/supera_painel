import { BriefcaseMedical, IdCard, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import {
  DetailField,
  DetailSection,
  PageHeader,
  StatusBadge,
  UserAvatar,
} from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { CONSELHO_POR_ESPECIALIDADE, ESPECIALIDADE_LABEL, PAPEL_LABEL } from "@/lib/enums";
import { formatDate } from "@/lib/format";
import { useMeuPerfil } from "../hooks/useMeuPerfil";

/**
 * Meu perfil — o cadastro de quem está logado, só para leitura.
 *
 * O básico (nome, e-mail, registro e área) vem da sessão e aparece de imediato.
 * As áreas em que a pessoa atua e a data de entrada vêm de uma leitura à parte;
 * se ela falhar, o resto da tela continua de pé e a falha é dita ali, no lugar.
 *
 * Não edita: o cadastro de um profissional é mantido por um administrador, e
 * dizer isso na tela evita que a pessoa procure um botão que não existe.
 */
export function ClinicoPerfilPage() {
  const { user } = useAuth();
  const perfil = useMeuPerfil();

  if (!user) return null;

  const conselho = user.especialidade ? CONSELHO_POR_ESPECIALIDADE[user.especialidade] : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={user.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : undefined}
        title="Meu perfil"
        subtitle="Os dados do seu cadastro na clínica"
      />

      <div className="grid max-w-4xl gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <DetailSection titulo="Identificação" icone={<IdCard size={15} />}>
            <div className="flex items-center gap-4">
              <UserAvatar name={user.nome} size="xl" colorful />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{user.nome}</p>
                <p className="text-muted-foreground truncate font-mono text-xs">{user.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge tone="success" size="sm" dot>
                    Ativo
                  </StatusBadge>
                  <span className="text-muted-foreground text-xs">{PAPEL_LABEL[user.papel]}</span>
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <DetailField rotulo="Nome">{user.nome}</DetailField>
              <DetailField rotulo="E-mail">
                <span className="break-all">{user.email}</span>
              </DetailField>
              <DetailField rotulo={conselho ?? "Registro no conselho"}>
                {user.registro ? <span className="break-all tabular-nums">{user.registro}</span> : undefined}
              </DetailField>
              <DetailField rotulo="Cadastrado em">
                {perfil.data?.criado_em ? (
                  <span className="tabular-nums">{formatDate(perfil.data.criado_em)}</span>
                ) : undefined}
              </DetailField>
            </dl>
          </DetailSection>
        </div>

        <DetailSection titulo="Atuação" icone={<BriefcaseMedical size={15} />}>
          {perfil.isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}

          {perfil.isError && (
            <p className="text-destructive text-sm" role="alert">
              Não foi possível carregar as suas áreas de atuação.{" "}
              <button type="button" className="underline" onClick={() => void perfil.refetch()}>
                Tentar de novo
              </button>
            </p>
          )}

          {perfil.data && perfil.data.areas.length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhuma área de atuação vigente.</p>
          )}

          {perfil.data && perfil.data.areas.length > 0 && (
            <ul className="flex flex-col gap-3" aria-label="Áreas de atuação">
              {perfil.data.areas.map((area) => (
                <li key={area.especialidade} className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {ESPECIALIDADE_LABEL[area.especialidade]}
                    {area.principal && (
                      <StatusBadge tone="neutral" size="sm">
                        Principal
                      </StatusBadge>
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    desde {formatDate(area.desde)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DetailSection>

        <DetailSection titulo="Acesso" icone={<ShieldCheck size={15} />}>
          <dl className="grid grid-cols-2 gap-4">
            <DetailField rotulo="Perfil">{PAPEL_LABEL[user.papel]}</DetailField>
            <DetailField rotulo="Situação">Ativo</DetailField>
          </dl>
          <Button asChild variant="outline" size="sm" className="w-fit">
            <Link to="../seguranca" relative="path">
              Segurança da conta
            </Link>
          </Button>
        </DetailSection>
      </div>

      <Alert role="note" className="max-w-4xl">
        <AlertDescription>
          Para corrigir nome, e-mail, registro ou área de atuação, fale com um administrador da clínica.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default ClinicoPerfilPage;
