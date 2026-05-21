import { Library, Camera, BookOpen, Database } from "lucide-react";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
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
    <div className="space-y-10">
      <StartSection />

      <StatisticSection
        totalBases={totalBases}
        totalBookWords={totalBookWords}
        totalWords={totalWords}
      />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_1fr]">
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


function StartSection(){
    return(
    <section className="w-full rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/40 p-8 md:p-12 shadow-2xl">
      <div className="max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
          Witaj w BrainLift
        </h1>

        <p className="mt-5 max-w-2xl text-lg md:text-xl leading-relaxed text-slate-400">
          Ucz się angielskiego mądrze — skanuj teksty, buduj słownik i ćwicz
          z fiszkami wspieranymi przez AI.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            to="/scan"
            className="flex items-center gap-3 rounded-2xl bg-violet-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-violet-500"
          >
            📷
            Skanuj zdjęcie
          </Link>

          <Link
            to="/flash"
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            🎓
            Ćwicz fiszki
          </Link>
        </div>
      </div>
    </section>
    )
}

function StatisticSection({ totalBases, totalBookWords, totalWords }) {
  const stats = [
    {
      icon: Library,
      value: totalWords,
      label: "Wszystkie słowa",
      color: "text-indigo-400",
      bg: "bg-indigo-500/15",
    },
    {
      icon: Camera,
      value: totalWords,
      label: "Ze skanów",
      color: "text-cyan-400",
      bg: "bg-cyan-500/15",
    },
    {
      icon: Database,
      value: totalBases,
      label: "Bazy danych",
      color: "text-orange-400",
      bg: "bg-orange-500/15",
    },
    {
      icon: BookOpen,
      value: totalBookWords,
      label: "Z książek",
      color: "text-pink-400",
      bg: "bg-pink-500/15",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.label}
            className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl"
          >
            <div
              className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl ${item.bg}`}
            >
              <Icon className={`h-6 w-6 ${item.color}`} />
            </div>

            <h3 className="text-3xl font-bold text-white">{item.value}</h3>

            <p className="mt-2 text-sm font-medium text-slate-400">
              {item.label}
            </p>
          </div>
        );
      })}
    </section>
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
      setError("Nie udało się dodać słowa.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="min-h-[560px] rounded-3xl border border-white/10 bg-slate-900/80 p-7 shadow-xl">
      <h2 className="mb-6 text-xl font-bold text-white">Dodaj nowe słowo</h2>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="flex gap-3">
          <input
            type="text"
            value={english}
            onChange={(event) => setEnglish(event.target.value)}
            placeholder="Słowo po angielsku..."
            className="w-full rounded-xl border border-white/10 bg-slate-800/70 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-violet-500"
          />

          <button className="whitespace-nowrap rounded-xl border border-white/10 bg-slate-950/40 px-5 py-3 text-slate-400 transition hover:bg-white/10 hover:text-white">
            AI Tłumacz
          </button>
        </div>

        <input
          type="text"
          value={polish}
          onChange={(event) => setPolish(event.target.value)}
          placeholder="Tłumaczenie po polsku..."
          className="w-full rounded-xl border border-white/10 bg-slate-800/70 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-violet-500"
        />

        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={selectedBaseId}
            onChange={(event) => {
              setSelectedBaseId(event.target.value);
              setNewBaseName("");
            }}
            className="w-full rounded-xl border border-white/10 bg-slate-800/70 px-4 py-3 text-white outline-none focus:border-violet-500"
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
            className="w-full rounded-xl border border-white/10 bg-slate-800/70 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-violet-500"
          />
        </div>

        {error && <p className="text-sm font-medium text-red-300">{error}</p>}

        {successMessage && (
          <p className="text-sm font-medium text-emerald-300">
            {successMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600/80 px-5 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
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
    <section>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Ostatnio dodane</h2>

        <Link
          to="/dictionary"
          className="text-sm font-medium text-violet-400 transition hover:text-violet-300"
        >
          Zobacz wszystkie →
        </Link>
      </div>

      <div className="space-y-3">
        {isLoading && (
          <p className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 text-slate-400">
            Ładowanie słów...
          </p>
        )}

        {error && (
          <p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-300">
            {error}
          </p>
        )}

        {!isLoading && !error && words.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 text-slate-400">
            Brak słów w bazie.
          </p>
        )}

        {words.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-bold text-white">
                    {item.english}
                  </h3>

                  <Camera className="h-4 w-4 text-slate-500" />
                </div>

                <p className="mt-2 text-base text-slate-400">
                  {item.polish}
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-slate-700/60 px-3 py-1 text-xs font-bold text-slate-400">
                {item.baseName}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
