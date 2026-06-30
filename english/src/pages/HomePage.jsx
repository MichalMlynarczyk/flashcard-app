import {
  BookOpen,
  Camera,
  CheckCircle2,
  Database,
  GraduationCap,
  Library,
  Plus,
  ScanText,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadStoredUser } from "../features/auth/services/authApi";
import {
  AuthRequiredError,
  createWord,
  fetchWordBases,
  fetchWords,
} from "../features/words/services/wordsApi";

const BOOK_BASE_NAME_PARTS = ["harrypotter", "harry potter", "warcraft"];

export default function HomePage() {
  const [latestWords, setLatestWords] = useState([]);
  const [totalWords, setTotalWords] = useState(0);
  const [totalBases, setTotalBases] = useState(0);
  const [totalBookWords, setTotalBookWords] = useState(0);
  const [isLoadingWords, setIsLoadingWords] = useState(true);
  const [wordsError, setWordsError] = useState("");
  const currentUser = loadStoredUser();

  async function loadLatestWords() {
    setIsLoadingWords(true);
    setWordsError("");

    try {
      const { basesData, totalBookWords: nextTotalBookWords, wordsData } =
        await fetchDashboardData();

      setLatestWords(wordsData.words);
      setTotalWords(wordsData.pagination.total);
      setTotalBases(basesData.bases.length);
      setTotalBookWords(nextTotalBookWords);
    } catch (error) {
      console.error(error);
      setWordsError("Nie udało się pobrać słów z bazy.");
    } finally {
      setIsLoadingWords(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadInitialLatestWords() {
      setIsLoadingWords(true);
      setWordsError("");

      try {
        const { basesData, totalBookWords: nextTotalBookWords, wordsData } =
          await fetchDashboardData();

        if (ignore) return;

        setLatestWords(wordsData.words);
        setTotalWords(wordsData.pagination.total);
        setTotalBases(basesData.bases.length);
        setTotalBookWords(nextTotalBookWords);
      } catch (error) {
        if (ignore) return;

        console.error(error);
        setWordsError("Nie udało się pobrać słów z bazy.");
      } finally {
        if (!ignore) {
          setIsLoadingWords(false);
        }
      }
    }

    loadInitialLatestWords();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <DashboardHeader userName={currentUser?.name} />

      <StatisticSection
        totalBases={totalBases}
        totalBookWords={totalBookWords}
        totalWords={totalWords}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.95fr]">
        <LearningSummary latestWords={latestWords} totalWords={totalWords} />
        <TodaySummary totalWords={totalWords} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <AddNewWord onWordAdded={loadLatestWords} />
        <LastAdd
          error={wordsError}
          isLoading={isLoadingWords}
          words={latestWords}
        />
      </div>
    </div>
  );
}


function DashboardHeader({ userName }) {
  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          Witaj{userName ? `, ${userName}` : ""}!
        </h1>

        <p className="mt-2 text-sm text-[#9aa8bc] md:text-base">
          Ucz się mądrzej z fiszkami wspieranymi przez AI.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/scan"
          className="inline-flex items-center gap-2 rounded-xl bg-[#5b45d6] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#050b14]/30 transition hover:bg-[#6a56e8]"
        >
          <ScanText className="h-4 w-4" />
          Skanuj tekst
        </Link>

        <Link
          to="/flash"
          className="inline-flex items-center gap-2 rounded-xl border border-[#40506a] bg-[#111827]/50 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#78b7ee]/12"
        >
          <GraduationCap className="h-4 w-4" />
          Ćwicz fiszki
        </Link>
      </div>
    </section>
  );
}

function StatisticSection({ totalBases, totalBookWords, totalWords }) {
  const stats = [
    {
      icon: Library,
      value: totalWords,
      label: "Wszystkie słowa",
      color: "text-[#9ed0ff]",
      bg: "bg-[#78b7ee]/15",
    },
    {
      icon: Camera,
      value: totalWords,
      label: "Ze skanów",
      color: "text-[#9ed0ff]",
      bg: "bg-[#78b7ee]/15",
    },
    {
      icon: Database,
      value: totalBases,
      label: "Bazy danych",
      color: "text-[#f0c77b]",
      bg: "bg-[#3d2f1f]/60",
    },
    {
      icon: BookOpen,
      value: totalBookWords,
      label: "Z książek",
      color: "text-[#d7a4d6]",
      bg: "bg-[#351f34]/80",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.label}
            className="rounded-2xl border border-[#40506a] bg-[#1c2636]/90 p-5 shadow-xl"
          >
            <div
              className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${item.bg}`}
            >
              <Icon className={`h-6 w-6 ${item.color}`} />
            </div>

            <h3 className="text-3xl font-bold text-white">{item.value}</h3>

            <p className="mt-2 text-sm font-medium text-[#9aa8bc]">
              {item.label}
            </p>
          </div>
        );
      })}
    </section>
  );
}

function LearningSummary({ latestWords, totalWords }) {
  const visibleWords = latestWords.slice(0, 5);
  const progress = totalWords > 0 ? Math.min((visibleWords.length / 5) * 100, 100) : 0;

  return (
    <section className="rounded-2xl border border-[#40506a] bg-[#1c2636]/90 p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white">Aktualnie uczysz się</h2>
        <Link
          to="/flash"
          className="text-sm font-semibold text-[#86bff0] transition hover:text-[#9ed0ff]"
        >
          Zobacz wszystkie
        </Link>
      </div>

      <div className="rounded-2xl border border-[#40506a] bg-[#111827]/55 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#9ed0ff]">
          Tryb nauka
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <h3 className="text-lg font-bold text-white">Nowe fiszki 1-5</h3>
            <p className="mt-1 text-sm text-[#9aa8bc]">
              Etap 1 · Pierwsza tura · PL → ENG
            </p>
          </div>
          <StudyMetric label="Znam" value={`${visibleWords.length}/5`} />
          <StudyMetric label="Zakres" value="1-5" />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#20324a]/80">
            <div
              className="h-full rounded-full bg-[#7868ff]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-10 text-right text-xs font-bold text-[#9ed0ff]">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </section>
  );
}

function StudyMetric({ label, value }) {
  return (
    <div className="min-w-20 rounded-xl bg-[#111827]/70 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-[#74849a]">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function TodaySummary({ totalWords }) {
  return (
    <section className="rounded-2xl border border-[#40506a] bg-[#1c2636]/90 p-5 shadow-xl">
      <h2 className="text-xl font-bold text-white">Dzisiaj</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-[8rem_1fr] sm:items-center">
        <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-[#24324a]">
          <div className="absolute inset-[-10px] rounded-full border-[10px] border-[#7868ff] border-b-transparent border-l-transparent" />
          <div className="relative text-center">
            <p className="text-3xl font-bold text-white">
              {Math.min(totalWords, 20)}
            </p>
            <p className="text-xs text-[#9aa8bc]">z 20 fiszek</p>
          </div>
        </div>

        <div className="space-y-4">
          <TodayRow icon={CheckCircle2} label="Nowe fiszki" value="8" />
          <TodayRow icon={GraduationCap} label="Powtórki" value="12" />
        </div>
      </div>
    </section>
  );
}

function TodayRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5b45d6]/25 text-[#9ed0ff]">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-lg font-bold text-white">{value}</span>
        <span className="text-sm text-[#9aa8bc]">{label}</span>
      </span>
    </div>
  );
}

async function fetchDashboardData() {
  const [wordsData, basesData] = await Promise.all([
    fetchWords({ limit: 10 }),
    fetchWordBases(),
  ]);
  const totalBookWords = await countBookWords(basesData.bases);

  return { basesData, totalBookWords, wordsData };
}

async function countBookWords(bases) {
  const bookBases = bases.filter((base) => isBookBaseName(base.name));

  if (bookBases.length === 0) {
    return 0;
  }

  const wordCounts = await Promise.all(
    bookBases.map(async (base) => {
      const data = await fetchWords({ baseId: base.id, page: 1, perPage: 1 });
      return data.pagination.total;
    })
  );

  return wordCounts.reduce((total, count) => total + count, 0);
}

function isBookBaseName(baseName) {
  const normalizedName = baseName.toLowerCase();
  return BOOK_BASE_NAME_PARTS.some((namePart) =>
    normalizedName.includes(namePart)
  );
}


function AddNewWord({ onWordAdded }) {
  const [english, setEnglish] = useState("");
  const [polish, setPolish] = useState("");
  const [bases, setBases] = useState([]);
  const [selectedBaseId, setSelectedBaseId] = useState("");
  const [newBaseName, setNewBaseName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadBases() {
      try {
        const data = await fetchWordBases();

        if (ignore) return;

        setBases(data.bases);
        setSelectedBaseId(data.bases[0]?.id?.toString() ?? "");
      } catch (loadError) {
        if (!ignore) {
          console.error(loadError);
        }
      }
    }

    loadBases();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!english.trim() || !polish.trim() || (!selectedBaseId && !newBaseName.trim())) {
      setError("Uzupełnij słowo, tłumaczenie i bazę.");
      return;
    }

    setIsSaving(true);

    try {
      await createWord({
        baseId: selectedBaseId || undefined,
        baseName: newBaseName.trim() || undefined,
        english: english.trim(),
        polish: polish.trim(),
      });

      setEnglish("");
      setPolish("");
      setNewBaseName("");
      setSuccessMessage("Słowo dodane do słownika.");
      await onWordAdded();

      const basesData = await fetchWordBases();
      setBases(basesData.bases);
      setSelectedBaseId(basesData.bases[0]?.id?.toString() ?? "");
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof AuthRequiredError
          ? saveError.message
          : "Nie udało się dodać słowa."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#40506a] bg-[#1c2636]/90 p-5 shadow-xl">
      <h2 className="mb-4 text-xl font-bold text-white">Dodaj nowe słowo</h2>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="flex gap-3">
          <input
            type="text"
            value={english}
            onChange={(event) => setEnglish(event.target.value)}
            placeholder="Słowo po angielsku..."
            className="w-full rounded-xl border border-[#40506a] bg-[#223047]/85 px-4 py-2.5 text-white outline-none placeholder:text-[#74849a] focus:border-[#78b7ee]"
          />

          <button className="whitespace-nowrap rounded-xl border border-[#40506a] bg-[#111827]/40 px-4 py-2.5 text-[#9aa8bc] transition hover:bg-[#78b7ee]/12 hover:text-white">
            AI Tłumacz
          </button>
        </div>

        <input
          type="text"
          value={polish}
          onChange={(event) => setPolish(event.target.value)}
          placeholder="Tłumaczenie po polsku..."
          className="w-full rounded-xl border border-[#40506a] bg-[#223047]/85 px-4 py-2.5 text-white outline-none placeholder:text-[#74849a] focus:border-[#78b7ee]"
        />

        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={selectedBaseId}
            onChange={(event) => {
              setSelectedBaseId(event.target.value);
              setNewBaseName("");
            }}
            className="w-full rounded-xl border border-[#40506a] bg-[#223047]/85 px-4 py-2.5 text-white outline-none focus:border-[#78b7ee]"
          >
            <option value="">Wybierz bazę</option>
            {bases.map((base) => (
              <option key={base.id} value={base.id}>
                {base.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={newBaseName}
            onChange={(event) => {
              setNewBaseName(event.target.value);
              setSelectedBaseId("");
            }}
            placeholder="Nowa baza, np. dom"
            className="w-full rounded-xl border border-[#40506a] bg-[#223047]/85 px-4 py-2.5 text-white outline-none placeholder:text-[#74849a] focus:border-[#78b7ee]"
          />
        </div>

        {error && <p className="text-sm font-medium text-red-300">{error}</p>}

        {successMessage && (
          <p className="text-sm font-medium text-[#9ed0ff]">
            {successMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#5b45d6] px-5 py-2.5 font-semibold text-white transition hover:bg-[#6a56e8] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-5 w-5" />
          {isSaving ? "Dodawanie..." : "Dodaj do słownika"}
        </button>
      </form>
    </section>
  );
}


function LastAdd({ error, isLoading, words }) {
  return (
    <section className="rounded-2xl border border-[#40506a] bg-[#1c2636]/90 p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Ostatnio dodane</h2>

        <Link
          to="/dictionary"
          className="text-sm font-medium text-[#86bff0] transition hover:text-[#9ed0ff]"
        >
          Zobacz wszystkie →
        </Link>
      </div>

      <div className="space-y-3">
        {isLoading && (
          <p className="rounded-2xl border border-[#40506a] bg-[#1c2636]/90 p-5 text-[#9aa8bc]">
            Ładowanie słów...
          </p>
        )}

        {error && (
          <p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-300">
            {error}
          </p>
        )}

        {!isLoading && !error && words.length === 0 && (
          <p className="rounded-2xl border border-[#40506a] bg-[#1c2636]/90 p-5 text-[#9aa8bc]">
            Brak słów w bazie.
          </p>
        )}

        {words.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-[#40506a] bg-[#351f34]/82 px-4 py-3 shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-bold text-white">
                    {item.english}
                  </h3>

                  <Camera className="h-4 w-4 text-[#74849a]" />
                </div>

                <p className="mt-1 text-sm text-[#9aa8bc]">
                  {item.polish}
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-[#33445f]/70 px-3 py-1 text-xs font-bold text-[#9aa8bc]">
                {item.baseName}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
