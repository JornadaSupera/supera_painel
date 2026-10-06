import { LogOut, Menu, Monitor, Moon, ShieldCheck, Sun, UserRound } from "lucide-react";
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
import { useAuth } from "@/contexts/auth-context";
import { useScrolled } from "@/hooks/useScrolled";
import { ESPECIALIDADE_LABEL, PAPEL_LABEL } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { panelAreaOf } from "@/routes/home-path";
import { useLayoutStore } from "@/stores/layout";
import { useThemeStore, type Theme } from "@/stores/theme";

/**
 * Top bar.
 *
 * Theme and the user menu.
 *
 * The global search and the notifications bell are NOT here on purpose. Both
 * sat in the bar as disabled controls, and a control that does nothing and does
 * not say why reads as a broken screen. They come back with the feature behind
 * them: the search once it reaches patients, professionals and content; the bell
 * once there is a source of notifications to list.
 */

const THEME_ICON: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/** The store keeps english keys; a screen reader must hear the menu's words. */
const THEME_LABEL: Record<Theme, string> = {
  light: "Claro",
  dark: "Escuro",
  system: "Sistema",
};

export function Topbar() {
  const { user, signOut } = useAuth();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setMobileMenuOpen = useLayoutStore((s) => s.setMobileMenuOpen);

  const ThemeIcon = THEME_ICON[theme];
  const scrolled = useScrolled();

  // The same screen in both panels, inside the frame the person belongs to.
  const area = panelAreaOf(user);
  const securityPath =
    area === "admin"
      ? "/seguranca"
      : area === "clinico" && user?.especialidade
        ? `/clinico/${user.especialidade}/seguranca`
        : null;

  const profilePath =
    area === "clinico" && user?.especialidade ? `/clinico/${user.especialidade}/perfil` : null;

  return (
    <header
      className={cn(
        "bg-background/80 sticky top-0 z-30 flex h-15 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-sm sm:px-6",
        // The edge and the shadow only show once content slides under the bar.
        "transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none",
        scrolled ? "border-border shadow-sm" : "border-transparent",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="Abrir menu"
        className="lg:hidden"
        onClick={() => setMobileMenuOpen(true)}
      >
        <Menu />
      </Button>

      <div className="ml-auto flex items-center gap-1">
        {/* ------------------------------------------------------ theme */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Tema: ${THEME_LABEL[theme]}`}>
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

              {profilePath && (
                <DropdownMenuItem asChild>
                  <Link to={profilePath}>
                    <UserRound />
                    Meu perfil
                  </Link>
                </DropdownMenuItem>
              )}

              {securityPath && (
                <DropdownMenuItem asChild>
                  <Link to={securityPath}>
                    <ShieldCheck />
                    Segurança da conta
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
