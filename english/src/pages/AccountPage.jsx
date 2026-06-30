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
        <div className="rounded-3xl border border-[#40506a] bg-[#1c2636]/90 p-6 shadow-xl md:p-8">
          <p className="text-sm font-semibold uppercase text-[#9ed0ff]">
            Konto i dostęp
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
            {currentUser ? `Cześć, ${currentUser.name}` : heading}
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#9aa8bc]">
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
            <p className="mt-5 rounded-2xl border border-[#40506a] bg-[#111827]/70 px-4 py-3 text-sm text-[#c5d3e4]">
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
    <div className="mt-8 grid rounded-2xl border border-[#40506a] bg-[#111827]/70 p-1 sm:inline-grid sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onModeChange("login")}
        className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
          mode === "login"
            ? "bg-[#78b7ee] text-white"
            : "text-[#9aa8bc] hover:bg-[#78b7ee]/8 hover:text-[#d7e7f8]"
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
            ? "bg-[#78b7ee] text-white"
            : "text-[#9aa8bc] hover:bg-[#78b7ee]/8 hover:text-[#d7e7f8]"
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
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#78b7ee] px-6 py-3 font-semibold text-white transition hover:bg-[#8cc5f4] disabled:cursor-not-allowed disabled:opacity-60"
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
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#78b7ee] px-6 py-3 font-semibold text-white transition hover:bg-[#8cc5f4] disabled:cursor-not-allowed disabled:opacity-60"
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
      <span className="text-sm font-semibold text-[#c5d3e4]">{label}</span>
      <span className="flex items-center gap-3 rounded-2xl border border-[#40506a] bg-[#111827]/70 px-4 py-3 text-[#d7e7f8] focus-within:border-[#78b7ee]/60">
        <Icon className="h-5 w-5 shrink-0 text-[#74849a]" />
        <input
          name={name}
          onChange={onChange}
          type={type}
          value={value}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#607086]"
          placeholder={label}
        />
      </span>
    </label>
  );
}

function AccountSummary({ user, onLogout }) {
  return (
    <div className="mt-8 grid max-w-xl gap-4">
      <div className="rounded-2xl border border-[#78b7ee]/35 bg-[#78b7ee]/12 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#9ed0ff]" />
          <div>
            <h2 className="text-lg font-bold text-white">Pełny dostęp</h2>
            <p className="mt-1 text-sm leading-6 text-[#d7e7f8]/85">
              Konto jest aktywne w backendzie. Twoje bazy i słowa są
              przypisane do tego użytkownika.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#40506a] bg-[#111827]/70 p-5">
        <p className="text-sm text-[#74849a]">Email</p>
        <p className="mt-1 break-words text-lg font-semibold text-white">
          {user.email}
        </p>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#40506a] bg-[#111827]/70 px-6 py-3 font-semibold text-[#d7e7f8] transition hover:bg-[#78b7ee]/12"
      >
        <LogOut className="h-5 w-5" />
        Wyloguj
      </button>
    </div>
  );
}

function GuestLimitsCard({ isLoggedIn }) {
  return (
    <aside className="rounded-3xl border border-[#40506a] bg-[#1c2636]/90 p-6 shadow-xl">
      <p className="text-sm font-semibold uppercase text-[#9ed0ff]">
        {isLoggedIn ? "Status konta" : "Tryb gościa"}
      </p>

      <h2 className="mt-3 text-2xl font-bold text-white">
        {isLoggedIn ? "Bez limitu na start" : "Limit przed logowaniem"}
      </h2>

      <p className="mt-3 text-sm leading-6 text-[#9aa8bc]">
        Użytkownik bez konta może wejść do aplikacji i sprawdzić wszystkie
        funkcje, ale frontend pokazuje limit próbny.
      </p>

      <div className="mt-6 grid gap-4">
        {GUEST_LIMITS.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-2xl border border-[#40506a] bg-[#111827]/70 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#78b7ee]/15">
                  <Icon className="h-5 w-5 text-[#9ed0ff]" />
                </div>
                <div>
                  <p className="text-sm text-[#74849a]">{item.label}</p>
                  <p className="text-xl font-bold text-white">
                    {isLoggedIn ? "Bez limitu" : item.value}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm leading-5 text-[#74849a]">
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
