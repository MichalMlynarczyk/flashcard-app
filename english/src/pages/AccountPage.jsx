import {
  CheckCircle2,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  ScanLine,
  UserPlus,
  UserRound,
  WholeWord,
} from "lucide-react";
import { useState } from "react";
import {
  loadStoredUser,
  loginUser,
  logoutUser,
  registerUser,
} from "../features/auth/services/authApi";

const GUEST_LIMITS = [
  {
    icon: WholeWord,
    label: "Słowa gościa",
    value: "200",
    note: "Po przekroczeniu limitu poprosimy o konto.",
  },
  {
    icon: ScanLine,
    label: "Skany gościa",
    value: "10",
    note: "Wystarczy do pierwszego testu aplikacji.",
  },
];

export default function AccountPage() {
  const [mode, setMode] = useState("login");
  const [currentUser, setCurrentUser] = useState(() => loadStoredUser());
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const isRegisterMode = mode === "register";
  const heading = isRegisterMode ? "Załóż konto" : "Zaloguj się";
  const subheading = isRegisterMode
    ? "Utwórz profil, żeby w przyszłości zapisywać dane użytkownika w bazie i odblokować pełny dostęp."
    : "Zalogowany użytkownik ma wstępnie pełny dostęp bez limitu słów i skanów.";

  function updateLoginField(event) {
    const { name, value } = event.target;
    setLoginForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  function updateRegisterField(event) {
    const { name, value } = event.target;
    setRegisterForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function createAccount(event) {
    event.preventDefault();
    setMessage("");

    const name = registerForm.name.trim();
    const email = normalizeEmail(registerForm.email);
    const password = registerForm.password;

    if (!name || !email || password.length < 6) {
      setMessage("Uzupełnij imię, poprawny email i hasło min. 6 znaków.");
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await registerUser({ email, name, password });
      setCurrentUser(data.user);
      setRegisterForm({ name: "", email: "", password: "" });
      setMessage("Konto utworzone. Dodałem też startową bazę Książki.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function login(event) {
    event.preventDefault();
    setMessage("");

    const email = normalizeEmail(loginForm.email);
    const password = loginForm.password;

    if (!email || !password) {
      setMessage("Podaj email i hasło.");
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await loginUser({ email, password });
      setCurrentUser(data.user);
      setLoginForm({ email: "", password: "" });
      setMessage("Zalogowano. Limit gościa jest zdjęty.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    try {
      await logoutUser();
    } catch (error) {
      console.error(error);
    } finally {
      setCurrentUser(null);
      setMessage("Wylogowano. Wracasz do limitu gościa.");
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl md:p-8">
          <p className="text-sm font-semibold uppercase text-violet-300">
            Konto i dostęp
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
            {currentUser ? `Cześć, ${currentUser.name}` : heading}
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-400">
            {currentUser
              ? "Masz aktywny profil. Backend zapisuje użytkownika, sesję oraz Twoje osobne bazy słów."
              : subheading}
          </p>

          {currentUser ? (
            <AccountSummary user={currentUser} onLogout={logout} />
          ) : (
            <>
              <ModeSwitch mode={mode} onModeChange={setMode} />

              {isRegisterMode ? (
                <RegisterForm
                  form={registerForm}
                  isSubmitting={isSubmitting}
                  onChange={updateRegisterField}
                  onSubmit={createAccount}
                />
              ) : (
                <LoginForm
                  form={loginForm}
                  isSubmitting={isSubmitting}
                  onChange={updateLoginField}
                  onSubmit={login}
                />
              )}
            </>
          )}

          {message && (
            <p className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
              {message}
            </p>
          )}
        </div>

        <GuestLimitsCard isLoggedIn={Boolean(currentUser)} />
      </section>
    </div>
  );
}

function ModeSwitch({ mode, onModeChange }) {
  return (
    <div className="mt-8 grid rounded-2xl border border-white/10 bg-slate-950/70 p-1 sm:inline-grid sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onModeChange("login")}
        className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
          mode === "login"
            ? "bg-violet-600 text-white"
            : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
        }`}
      >
        <LogIn className="h-4 w-4" />
        Logowanie
      </button>

      <button
        type="button"
        onClick={() => onModeChange("register")}
        className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
          mode === "register"
            ? "bg-violet-600 text-white"
            : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
        }`}
      >
        <UserPlus className="h-4 w-4" />
        Tworzenie konta
      </button>
    </div>
  );
}

function LoginForm({ form, isSubmitting, onChange, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="mt-6 grid max-w-xl gap-4">
      <FormField
        icon={Mail}
        label="Email"
        name="email"
        onChange={onChange}
        type="email"
        value={form.email}
      />
      <FormField
        icon={LockKeyhole}
        label="Hasło"
        name="password"
        onChange={onChange}
        type="password"
        value={form.password}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogIn className="h-5 w-5" />
        {isSubmitting ? "Logowanie..." : "Zaloguj"}
      </button>
    </form>
  );
}

function RegisterForm({ form, isSubmitting, onChange, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="mt-6 grid max-w-xl gap-4">
      <FormField
        icon={UserRound}
        label="Imię"
        name="name"
        onChange={onChange}
        value={form.name}
      />
      <FormField
        icon={Mail}
        label="Email"
        name="email"
        onChange={onChange}
        type="email"
        value={form.email}
      />
      <FormField
        icon={LockKeyhole}
        label="Hasło"
        name="password"
        onChange={onChange}
        type="password"
        value={form.password}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <UserPlus className="h-5 w-5" />
        {isSubmitting ? "Tworzenie..." : "Utwórz konto"}
      </button>
    </form>
  );
}

function FormField({
  icon: Icon,
  label,
  name,
  onChange,
  type = "text",
  value,
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-slate-300">{label}</span>
      <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-200 focus-within:border-violet-500/60">
        <Icon className="h-5 w-5 shrink-0 text-slate-500" />
        <input
          name={name}
          onChange={onChange}
          type={type}
          value={value}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-600"
          placeholder={label}
        />
      </span>
    </label>
  );
}

function AccountSummary({ user, onLogout }) {
  return (
    <div className="mt-8 grid max-w-xl gap-4">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-300" />
          <div>
            <h2 className="text-lg font-bold text-white">Pełny dostęp</h2>
            <p className="mt-1 text-sm leading-6 text-emerald-100/80">
              Konto jest aktywne w backendzie. Twoje bazy i słowa są
              przypisane do tego użytkownika.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <p className="text-sm text-slate-500">Email</p>
        <p className="mt-1 break-words text-lg font-semibold text-white">
          {user.email}
        </p>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-6 py-3 font-semibold text-slate-200 transition hover:bg-white/10"
      >
        <LogOut className="h-5 w-5" />
        Wyloguj
      </button>
    </div>
  );
}

function GuestLimitsCard({ isLoggedIn }) {
  return (
    <aside className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
      <p className="text-sm font-semibold uppercase text-cyan-300">
        {isLoggedIn ? "Status konta" : "Tryb gościa"}
      </p>

      <h2 className="mt-3 text-2xl font-bold text-white">
        {isLoggedIn ? "Bez limitu na start" : "Limit przed logowaniem"}
      </h2>

      <p className="mt-3 text-sm leading-6 text-slate-400">
        Użytkownik bez konta może wejść do aplikacji i sprawdzić wszystkie
        funkcje, ale frontend pokazuje limit próbny.
      </p>

      <div className="mt-6 grid gap-4">
        {GUEST_LIMITS.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                  <Icon className="h-5 w-5 text-cyan-300" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className="text-xl font-bold text-white">
                    {isLoggedIn ? "Bez limitu" : item.value}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm leading-5 text-slate-500">
                {isLoggedIn ? "Dostęp odblokowany po zalogowaniu." : item.note}
              </p>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
