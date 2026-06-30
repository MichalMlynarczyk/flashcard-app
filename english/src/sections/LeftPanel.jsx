import {
  Camera,
  BrainCircuit,
  BookOpen,
  ChevronRight,
  GraduationCap,
  LogOut,
  Library,
  Menu,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  AUTH_SESSION_CHANGE_EVENT,
  loadStoredUser,
  logoutUser,
} from "../features/auth/services/authApi";

const menu = [
  { name: "Dashboard", icon: Sparkles, path: "/" },
  { name: "Skanuj", icon: Camera, path: "/scan" },
  { name: "Fiszki", icon: GraduationCap, path: "/flash" },
  { name: "Słownik", icon: Library, path: "/dictionary" },
  { name: "Książki", icon: BookOpen, path: "/book" },
];

export default function LeftPanel() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => loadStoredUser());

  useEffect(() => {
    function syncCurrentUser() {
      setCurrentUser(loadStoredUser());
    }

    window.addEventListener(AUTH_SESSION_CHANGE_EVENT, syncCurrentUser);
    window.addEventListener("storage", syncCurrentUser);

    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGE_EVENT, syncCurrentUser);
      window.removeEventListener("storage", syncCurrentUser);
    };
  }, []);

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
  }

  async function logout() {
    try {
      await logoutUser();
    } catch (error) {
      console.error(error);
    } finally {
      setCurrentUser(null);
      closeMobileMenu();
    }
  }

  return (
    <>
      <aside className="hidden min-h-screen w-64 shrink-0 border-r border-[#26354c] bg-[#111827] px-4 py-7 xl:flex xl:flex-col">
        <Logo className="mb-9 px-2" />
        <NavigationItems pathname={location.pathname} />
        <SidebarFooter currentUser={currentUser} onLogout={logout} />
      </aside>

      <header className="sticky top-0 z-40 border-b border-[#40506a] bg-[#111827]/95 px-4 py-3 backdrop-blur xl:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 md:flex-col md:items-stretch xl:flex-row">
          <Logo className="shrink-0" imageClassName="h-12 w-auto" />

          <nav className="hidden w-full grid-cols-3 gap-3 md:grid">
            {menu.map((item) => (
              <TopNavLink
                key={item.path}
                item={item}
                active={location.pathname === item.path}
              />
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#78b7ee]/12 text-[#d7e7f8] transition hover:bg-[#78b7ee]/20 md:hidden"
            aria-label="Otwórz menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Zamknij menu"
            onClick={closeMobileMenu}
          />

          <aside className="absolute right-0 top-0 flex h-full w-[min(22rem,86vw)] flex-col border-l border-[#40506a] bg-[#111827] p-5 shadow-2xl">
            <div className="mb-8 flex items-center justify-between gap-4">
              <Logo imageClassName="h-12 w-auto" onClick={closeMobileMenu} />

              <button
                type="button"
                onClick={closeMobileMenu}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#78b7ee]/12 text-[#d7e7f8] transition hover:bg-[#78b7ee]/20"
                aria-label="Zamknij menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <NavigationItems
              pathname={location.pathname}
              onNavigate={closeMobileMenu}
            />
            <SidebarFooter
              currentUser={currentUser}
              onLogout={logout}
              onNavigate={closeMobileMenu}
            />
          </aside>
        </div>
      )}
    </>
  );
}

function Logo({ className = "", onClick }) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className={`flex items-center gap-3 ${className}`}
      aria-label="Przejdź do dashboardu"
    >
      <BrainCircuit className="h-8 w-8 text-[#9ed0ff]" />
      <span className="text-2xl font-bold tracking-tight text-white">
        BrainLift
      </span>
    </Link>
  );
}

function NavigationItems({ pathname, onNavigate }) {
  return (
    <nav className="space-y-4">
      {menu.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.path;

        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-4 py-3 text-left transition ${
              active
                ? "border border-[#5f55d9]/35 bg-[#5b45d6]/18 text-[#9c92ff]"
                : "text-[#a1adbf] hover:bg-[#78b7ee]/8 hover:text-[#d7e7f8]"
            }`}
          >
            <span className="flex items-center gap-4 text-sm font-semibold">
              <Icon className="h-5 w-5" />
              <span className="truncate">{item.name}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ currentUser, onLogout, onNavigate }) {
  const displayName = currentUser?.name ?? "michal";
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="mt-auto border-t border-[#26354c] pt-5">
      <Link
        to="/account"
        onClick={onNavigate}
        className="mb-5 flex items-center justify-between rounded-xl px-3 py-2.5 text-[#d7e7f8] transition hover:bg-[#78b7ee]/8"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#293449] text-sm font-bold text-white">
            {initial}
          </span>
          <span className="truncate text-sm font-semibold">{displayName}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-[#9aa8bc]" />
      </Link>

      <div className="space-y-4">
        <Link
          to="/account"
          onClick={onNavigate}
          className="flex items-center gap-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#a1adbf] transition hover:bg-[#78b7ee]/8 hover:text-[#d7e7f8]"
        >
          <Settings className="h-5 w-5" />
          Ustawienia
        </Link>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-4 rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-[#a1adbf] transition hover:bg-[#78b7ee]/8 hover:text-[#d7e7f8]"
        >
          <LogOut className="h-5 w-5" />
          Wyloguj
        </button>
      </div>
    </div>
  );
}

function TopNavLink({ item, active }) {
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      className={`flex min-w-0 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
        active
          ? "border-[#78b7ee]/45 bg-[#78b7ee]/18 text-[#9ed0ff]"
          : "border-[#40506a] bg-[#1c2636]/90 text-[#9aa8bc] hover:bg-[#78b7ee]/12 hover:text-[#d7e7f8]"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{item.name}</span>
    </Link>
  );
}
