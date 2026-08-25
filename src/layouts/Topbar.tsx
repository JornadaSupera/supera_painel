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
 * Top bar.
 *
 * Global search, theme, notifications and the user menu. The search gets its
 * real implementation once there is something to search; it already takes the
 * right spot here so the layout does not shift later.
 */

const THEME_ICON: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function Topbar() {
  const { user, signOut } = useAuth();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setMobileMenuOpen = useLayoutStore((s) => s.setMobileMenuOpen);

  const ThemeIcon = THEME_ICON[theme];

  return (
    <header className="bg-background/80 border-border sticky top-0 z-30 flex h-15 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-sm sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Abrir menu"
        className="lg:hidden"
        onClick={() => setMobileMenuOpen(true)}
      >
        <Menu />
      </Button>

      {/* ------------------------------------------------------- search */}
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
          // The global search lands once there is data to search.
          disabled
          className="pl-9"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* ------------------------------------------------------ theme */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Tema: ${theme}`}>
              <ThemeIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Aparência</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as Theme)}
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

        {/* ----------------------------------------------- notifications */}
        <Button variant="ghost" size="icon" aria-label="Notificações" disabled>
          <Bell />
        </Button>

        {/* -------------------------------------------------------- user */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="ml-1 h-auto gap-2 px-2 py-1.5">
                <UserAvatar name={user.nome} size="sm" colorful />
                <span className="hidden text-left leading-tight md:flex md:flex-col">
                  <span className="text-sm font-medium">{user.nome.split(" ")[0]}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {PAPEL_LABEL[user.papel]}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate">{user.nome}</span>
                <span className="text-muted-foreground truncate font-mono text-[11px] font-normal">
                  {user.email}
                </span>
                <span className="text-muted-foreground text-[11px] font-normal">
                  {PAPEL_LABEL[user.papel]}
                  {user.especialidade && ` · ${ESPECIALIDADE_LABEL[user.especialidade]}`}
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

              <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
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
