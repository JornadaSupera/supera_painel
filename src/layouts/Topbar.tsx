import { Bell, LogOut, Menu, Monitor, Moon, Palette, Search, Sun } from "lucide-react";
import { Link } from "react-router-dom";

import { UserAvatar } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { ESPECIALIDADE_LABEL, PAPEL_LABEL } from "@/lib/enums";
import { useLayoutStore } from "@/stores/layout";
import { useThemeStore, type Theme } from "@/stores/theme";

/**
 * Barra superior.
 *
 * Busca global, tema, notificações e menu do usuário. A busca ganha
 * implementação real na Fase 5, quando existir o que buscar; aqui já ocupa o
 * lugar certo para não deslocar o layout depois.
 */

const ICONE_TEMA: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function Topbar() {
  const { usuario, sair } = useAuth();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setMenuMobileAberto = useLayoutStore((s) => s.setMenuMobileAberto);

  const IconeTema = ICONE_TEMA[theme];

  return (
    <header className="bg-background/80 border-border sticky top-0 z-30 flex h-15 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-sm sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Abrir menu"
        className="lg:hidden"
        onClick={() => setMenuMobileAberto(true)}
      >
        <Menu />
      </Button>

      {/* -------------------------------------------------------- busca */}
      <div className="relative hidden max-w-90 flex-1 items-center sm:flex">
        <Search
          size={16}
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute left-3"
        />
        <Input
          type="search"
          placeholder="Buscar paciente, profissional ou conteúdo…"
          aria-label="Busca global"
          // A busca global entra na Fase 5, com dados para buscar.
          disabled
          className="pl-9"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* ------------------------------------------------------- tema */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Tema: ${theme}`}>
              <IconeTema />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Aparência</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(valor) => setTheme(valor as Theme)}
            >
              <DropdownMenuRadioItem value="light">
                <Sun />
                Claro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon />
                Escuro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor />
                Sistema
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ----------------------------------------------- notificações */}
        <Button variant="ghost" size="icon" aria-label="Notificações" disabled>
          <Bell />
        </Button>

        {/* -------------------------------------------------- usuário */}
        {usuario && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="ml-1 h-auto gap-2 px-2 py-1.5">
                <UserAvatar nome={usuario.nome} size="sm" colorido />
                <span className="hidden text-left leading-tight md:flex md:flex-col">
                  <span className="text-sm font-medium">{usuario.nome.split(" ")[0]}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {PAPEL_LABEL[usuario.papel]}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate">{usuario.nome}</span>
                <span className="text-muted-foreground truncate font-mono text-[11px] font-normal">
                  {usuario.email}
                </span>
                <span className="text-muted-foreground text-[11px] font-normal">
                  {PAPEL_LABEL[usuario.papel]}
                  {usuario.especialidade && ` · ${ESPECIALIDADE_LABEL[usuario.especialidade]}`}
                </span>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              {import.meta.env.DEV && (
                <DropdownMenuItem asChild>
                  <Link to="/design-system">
                    <Palette />
                    Design System
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem variant="destructive" onSelect={() => void sair()}>
                <LogOut />
                Sair do painel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}

export default Topbar;
