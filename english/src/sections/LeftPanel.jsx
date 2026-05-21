import {
  Camera,
  BookOpen,
  GraduationCap,
  Library,
  Menu,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import logo from "../assets/logo.png";
import {
  AUTH_SESSION_CHANGE_EVENT,
  loadStoredUser,
} from "../features/auth/services/authApi";

const menu = [
  { name: "Dashboard", icon: Sparkles, path: "/" },
  { name: "Skanuj", icon: Camera, path: "/scan" },
  { name: "Fiszki", icon: GraduationCap, path: "/flash" },
  { name: "Słownik", icon: Library, path: "/dictionary" },
  { name: "Książki", icon: BookOpen, path: "/book" },
  { name: "Konto", icon: UserRound, path: "/account" },
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

  return (
    <>
      <aside className="hidden min-h-screen w-80 shrink-0 border-r border-white/10 bg-slate-950 px-5 py-8 xl:block">
        <Logo className="mb-8 justify-center" />
        <NavigationItems pathname={location.pathname} currentUser={currentUser} />
      </aside>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur xl:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 md:flex-col md:items-stretch xl:flex-row">
          <Logo className="shrink-0" imageClassName="h-12 w-auto" />

          <nav className="hidden w-full grid-cols-3 gap-3 md:grid">
            {menu.map((item) => (
              <TopNavLink
                key={item.path}
                item={item}
                active={location.pathname === item.path}
                currentUser={currentUser}
              />
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-slate-200 transition hover:bg-white/20 md:hidden"
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

          <aside className="absolute right-0 top-0 flex h-full w-[min(22rem,86vw)] flex-col border-l border-white/10 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-8 flex items-center justify-between gap-4">
              <Logo imageClassName="h-12 w-auto" onClick={closeMobileMenu} />

              <button
                type="button"
                onClick={closeMobileMenu}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-slate-200 transition hover:bg-white/20"
                aria-label="Zamknij menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <NavigationItems
              pathname={location.pathname}
              onNavigate={closeMobileMenu}
              currentUser={currentUser}
            />
          </aside>
        </div>
      )}
    </>
  );
}

function Logo({
  className = "",
  imageClassName = "scale-[1] origin-center",
  onClick,
}) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className={`flex ${className}`}
      aria-label="Przejdź do dashboardu"
    >
      <img src={logo} alt="FlashWords" className={imageClassName} />
    </Link>
  );
}

function NavigationItems({ pathname, onNavigate, currentUser }) {
  return (
    <nav className="space-y-3">
      {menu.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.path;
        const label = getMenuItemLabel(item, currentUser);

        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-5 py-4 text-left transition ${
              active
                ? "bg-violet-600/25 text-violet-400"
                : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
            }`}
          >
            <span className="flex items-center gap-4 text-lg font-medium">
              <Icon className="h-6 w-6" />
              <span className="truncate">{label}</span>
            </span>

            {active && <span className="h-2 w-2 rounded-full bg-violet-400" />}
          </Link>
        );
      })}
    </nav>
  );
}

function TopNavLink({ item, active, currentUser }) {
  const Icon = item.icon;
  const label = getMenuItemLabel(item, currentUser);

  return (
    <Link
      to={item.path}
      className={`flex min-w-0 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
        active
          ? "border-violet-500/30 bg-violet-600/25 text-violet-300"
          : "border-white/10 bg-slate-900/80 text-slate-400 hover:bg-white/10 hover:text-slate-200"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function getMenuItemLabel(item, currentUser) {
  if (item.path === "/account" && currentUser?.name) {
    return currentUser.name;
  }

  return item.name;
}
