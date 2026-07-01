import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Repeat2,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadStoredUser } from "../features/auth/services/authApi";
import { fetchStudyStats } from "../features/words/services/wordsApi";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
const METRICS = [
  {
    key: "cycles",
    label: "Ukończone cykle",
    shortLabel: "Cykle",
    color: "#9ed0ff",
    bg: "bg-[#78b7ee]/15",
    text: "text-[#9ed0ff]",
    icon: BarChart3,
  },
  {
    key: "newWords",
    label: "Nowe słowa nauczone",
    shortLabel: "Nowe",
    color: "#d7a4d6",
    bg: "bg-[#351f34]/80",
    text: "text-[#d7a4d6]",
    icon: Sparkles,
  },
  {
    key: "reviews",
    label: "Powtórzenia",
    shortLabel: "Powtórki",
    color: "#f0c77b",
    bg: "bg-[#3d2f1f]/60",
    text: "text-[#f0c77b]",
    icon: Repeat2,
  },
];

export default function StatsPage() {
  const [currentUser] = useState(() => loadStoredUser());
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const weekData = useMemo(
    () => buildWeekData(weekOffset, stats?.dailyProgress ?? []),
    [stats?.dailyProgress, weekOffset]
  );
  const totals = useMemo(() => getWeekTotals(weekData), [weekData]);
  const allTimeTotals = useMemo(
    () => ({
      cycles: stats?.summary.totalCycles ?? 0,
      newWords: stats?.summary.totalNewWords ?? 0,
      reviews: stats?.summary.totalReviews ?? 0,
    }),
    [stats]
  );

  useEffect(() => {
    let ignore = false;

    async function loadStats() {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const data = await fetchStudyStats();

        if (!ignore) {
          setStats(data);
        }
      } catch (loadError) {
        if (!ignore) {
          console.error(loadError);
          setError("Nie udało się pobrać statystyk nauki.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      ignore = true;
    };
  }, [currentUser]);

  if (!currentUser) {
    return <LoginPrompt />;
  }

  return (
    <div className="space-y-6">
      <StatsHeader userName={currentUser.name} />

      {isLoading && <StatsMessage>Ładowanie statystyk...</StatsMessage>}
      {error && <StatsMessage variant="error">{error}</StatsMessage>}

      {!isLoading && !error && (
        <>
          <WeekToolbar
            rangeLabel={getWeekRangeLabel(weekData)}
            weekOffset={weekOffset}
            onNextWeek={() =>
              setWeekOffset((current) => Math.min(current + 1, 0))
            }
            onPreviousWeek={() => setWeekOffset((current) => current - 1)}
          />

          <SummaryCards totals={totals} />

          <WeeklyBarChart data={weekData} />

          <TotalDonutCharts totals={allTimeTotals} />
        </>
      )}
    </div>
  );
}

function StatsHeader({ userName }) {
  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9ed0ff]">
          Statystyki
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
          Postępy w nauce{userName ? `, ${userName}` : ""}
        </h1>
        <p className="mt-2 text-sm text-[#9aa8bc] md:text-base">
          Podgląd tygodnia: cykle, nowe słowa i powtórzenia.
        </p>
      </div>

      <Link
        to="/flash"
        className="inline-flex items-center gap-2 rounded-xl bg-[#5b45d6] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#050b14]/30 transition hover:bg-[#6a56e8]"
      >
        <GraduationCap className="h-4 w-4" />
        Ucz się
      </Link>
    </section>
  );
}

function WeekToolbar({ onNextWeek, onPreviousWeek, rangeLabel, weekOffset }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[#40506a] bg-[#1c2636]/90 p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#74849a]">
          Widok 7 dni
        </p>
        <h2 className="mt-1 text-xl font-bold text-white">{rangeLabel}</h2>
      </div>

      <div className="flex items-center gap-3">
        <IconButton label="Poprzedni tydzień" onClick={onPreviousWeek}>
          <ChevronLeft className="h-5 w-5" />
        </IconButton>

        <span className="min-w-24 rounded-xl bg-[#111827]/70 px-4 py-2 text-center text-sm font-semibold text-[#c5d3e4]">
          {weekOffset === 0 ? "Ten tydzień" : `${Math.abs(weekOffset)} tyg. temu`}
        </span>

        <IconButton
          disabled={weekOffset === 0}
          label="Następny tydzień"
          onClick={onNextWeek}
        >
          <ChevronRight className="h-5 w-5" />
        </IconButton>
      </div>
    </section>
  );
}

function IconButton({ children, disabled = false, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#78b7ee]/12 text-[#d7e7f8] transition hover:bg-[#78b7ee]/20 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SummaryCards({ totals }) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {METRICS.map((metric) => {
        const Icon = metric.icon;

        return (
          <article
            key={metric.key}
            className="rounded-2xl border border-[#40506a] bg-[#1c2636]/90 p-5 shadow-xl"
          >
            <span
              className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${metric.bg} ${metric.text}`}
            >
              <Icon className="h-6 w-6" />
            </span>
            <h2 className="text-3xl font-bold text-white">
              {totals[metric.key]}
            </h2>
            <p className="mt-2 text-sm font-medium text-[#9aa8bc]">
              {metric.label}
            </p>
          </article>
        );
      })}
    </section>
  );
}

function WeeklyBarChart({ data }) {
  const maxValues = METRICS.reduce(
    (values, metric) => ({
      ...values,
      [metric.key]: Math.max(...data.map((day) => day[metric.key]), 1),
    }),
    {}
  );

  return (
    <section className="rounded-2xl border border-[#40506a] bg-[#1c2636]/90 p-5 shadow-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Aktywność tygodnia</h2>
          <p className="mt-1 text-sm text-[#9aa8bc]">
            Każdy dzień ma trzy słupki: cykle, nowe słowa i powtórki.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {METRICS.map((metric) => (
            <span
              key={metric.key}
              className="inline-flex items-center gap-2 rounded-full bg-[#111827]/70 px-3 py-1.5 text-xs font-semibold text-[#c5d3e4]"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: metric.color }}
              />
              {metric.shortLabel}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-7 overflow-x-auto pb-2">
        <div className="grid min-w-[760px] grid-cols-7 gap-4">
          {data.map((day) => (
            <DayBars key={day.isoDate} day={day} maxValues={maxValues} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DayBars({ day, maxValues }) {
  return (
    <article className="rounded-2xl bg-[#111827]/55 p-4">
      <div className="mb-4 text-center">
        <p className="text-sm font-bold text-white">{day.dayName}</p>
        <p className="mt-1 text-xs text-[#74849a]">{day.dateLabel}</p>
      </div>

      <div className="flex h-64 items-end justify-center gap-3">
        {METRICS.map((metric) => {
          const value = day[metric.key];
          const maxValue = maxValues[metric.key];
          const height = `${Math.max((value / maxValue) * 100, value > 0 ? 8 : 0)}%`;

          return (
            <div
              key={metric.key}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
            >
              <span className="text-xs font-bold text-[#c5d3e4]">{value}</span>
              <div className="flex h-full w-full items-end rounded-full bg-[#20324a]/65 p-1">
                <div
                  className="w-full rounded-full transition-all duration-300"
                  style={{ backgroundColor: metric.color, height }}
                  title={`${metric.label}: ${value}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function TotalDonutCharts({ totals }) {
  const donutItems = [
    {
      label: "Wszystkie cykle",
      value: totals.cycles,
      maxValue: Math.max(totals.cycles, 1),
      color: "#9ed0ff",
      helper: "Suma ukończonych cykli ze wszystkich tygodni",
    },
    {
      label: "Nauczone słowa",
      value: totals.newWords,
      maxValue: Math.max(totals.newWords, 1),
      color: "#d7a4d6",
      helper: "Suma nowych słów nauczonych ze wszystkich tygodni",
    },
  ];

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      {donutItems.map((item) => (
        <article
          key={item.label}
          className="rounded-2xl border border-[#40506a] bg-[#1c2636]/90 p-5 shadow-xl"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <DonutChart
              color={item.color}
              maxValue={item.maxValue}
              value={item.value}
            />

            <div className="min-w-0">
              <h2 className="text-xl font-bold text-white">{item.label}</h2>
              <p className="mt-2 text-sm leading-6 text-[#9aa8bc]">
                {item.helper}
              </p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function DonutChart({ color, maxValue, value }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / maxValue, 1);
  const dashOffset = circumference * (1 - progress);
  const displayValue = formatStatNumber(value);
  const valueClassName =
    displayValue.length > 5
      ? "text-3xl"
      : displayValue.length > 4
        ? "text-[2.15rem]"
        : "text-4xl";

  return (
    <div className="relative mx-auto h-44 w-44 shrink-0 sm:mx-0">
      <svg
        className="h-full w-full -rotate-90"
        viewBox="0 0 160 160"
        role="img"
        aria-label={`Wynik ${value}`}
      >
        <circle
          cx="80"
          cy="80"
          fill="none"
          r={radius}
          stroke="#20324a"
          strokeWidth="18"
        />
        <circle
          cx="80"
          cy="80"
          fill="none"
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth="18"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`${valueClassName} max-w-28 text-center font-bold leading-none text-white [overflow-wrap:anywhere]`}
        >
          {displayValue}
        </span>
        <span className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#74849a]">
          total
        </span>
      </div>
    </div>
  );
}

function LoginPrompt() {
  return (
    <section className="rounded-2xl border border-[#40506a] bg-[#1c2636]/90 p-7 text-center shadow-xl">
      <h1 className="text-3xl font-bold text-white">Statystyki</h1>
      <p className="mx-auto mt-3 max-w-xl text-[#9aa8bc]">
        Zaloguj się, żeby zobaczyć wykresy postępów w trybie nauka.
      </p>
      <Link
        to="/account"
        className="mt-6 inline-flex rounded-2xl bg-[#78b7ee] px-5 py-3 font-semibold text-white transition hover:bg-[#8cc5f4]"
      >
        Przejdź do konta
      </Link>
    </section>
  );
}

function StatsMessage({ children, variant = "default" }) {
  const className =
    variant === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-300"
      : "border-[#40506a] bg-[#1c2636]/90 text-[#9aa8bc]";

  return <section className={`rounded-2xl border p-6 ${className}`}>{children}</section>;
}

function buildWeekData(weekOffset, dailyProgress) {
  const today = stripTime(new Date());
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const monday = new Date(today.getTime() - dayOfWeek * MS_PER_DAY);
  monday.setDate(monday.getDate() + weekOffset * WEEK_DAYS);
  const progressByDay = new Map(
    dailyProgress.map((item) => [item.day, item])
  );

  return Array.from({ length: WEEK_DAYS }, (_, index) => {
    const date = new Date(monday.getTime() + index * MS_PER_DAY);
    const dayStats = progressByDay.get(formatIsoDate(date));

    return {
      isoDate: date.toISOString(),
      dayName: formatDayName(date),
      dateLabel: formatShortDate(date),
      cycles: dayStats?.cycles ?? 0,
      newWords: dayStats?.newWords ?? 0,
      reviews: dayStats?.reviews ?? 0,
    };
  });
}

function getWeekTotals(data) {
  return data.reduce(
    (totals, day) => ({
      cycles: totals.cycles + day.cycles,
      newWords: totals.newWords + day.newWords,
      reviews: totals.reviews + day.reviews,
    }),
    { cycles: 0, newWords: 0, reviews: 0 }
  );
}

function getWeekRangeLabel(data) {
  const firstDay = data[0];
  const lastDay = data[data.length - 1];

  return `${firstDay.dateLabel} - ${lastDay.dateLabel}`;
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatIsoDate(value) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDayName(value) {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "short",
  }).format(value);
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  }).format(value);
}

function formatStatNumber(value) {
  return new Intl.NumberFormat("pl-PL").format(value);
}
