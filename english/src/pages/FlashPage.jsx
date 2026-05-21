import { ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchAllWords,
  fetchWordBases,
} from "../features/words/services/wordsApi";

export default function FlashPage() {
  const [bases, setBases] = useState([]);
  const [selectedBaseId, setSelectedBaseId] = useState(null);
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [frontLanguage, setFrontLanguage] = useState("english");
  const [isLoadingBases, setIsLoadingBases] = useState(true);
  const [isLoadingWords, setIsLoadingWords] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadBases() {
      try {
        const data = await fetchWordBases();

        if (!ignore) {
          setBases(data.bases);
        }
      } catch (loadError) {
        if (!ignore) {
          console.error(loadError);
          setError("Nie udało się pobrać baz fiszek.");
        }
      } finally {
        if (!ignore) {
          setIsLoadingBases(false);
        }
      }
    }

    loadBases();

    return () => {
      ignore = true;
    };
  }, []);

  async function startFlashcards(baseId) {
    setSelectedBaseId(baseId);
    setIsLoadingWords(true);
    setError("");
    setWords([]);
    setCurrentIndex(0);
    setIsFlipped(false);

    try {
      const data = await fetchAllWords({
        baseId: baseId === "all" ? undefined : baseId,
      });

      setWords(data);
    } catch (loadError) {
      console.error(loadError);
      setError("Nie udało się pobrać fiszek z bazy.");
    } finally {
      setIsLoadingWords(false);
    }
  }

  const currentWord = words[currentIndex];
  const progress = useMemo(() => {
    if (words.length === 0) return 0;

    return ((currentIndex + 1) / words.length) * 100;
  }, [currentIndex, words.length]);

  function goToCard(nextIndex) {
    if (words.length === 0) return;

    const normalizedIndex = (nextIndex + words.length) % words.length;

    setCurrentIndex(normalizedIndex);
    setIsFlipped(false);
  }

  function goToNextCard() {
    goToCard(currentIndex + 1);
  }

  function goToPreviousCard() {
    goToCard(currentIndex - 1);
  }

  function changeFrontLanguage(language) {
    setFrontLanguage(language);
    setIsFlipped(false);
  }

  function returnToBaseSelection() {
    setSelectedBaseId(null);
    setWords([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setError("");
  }

  return (
    <div className="space-y-10">
      <FlashPageDescription />

      {selectedBaseId === null && (
        <BaseSelectionCard
          bases={bases}
          isLoading={isLoadingBases}
          onSelectBase={startFlashcards}
        />
      )}

      {selectedBaseId !== null && (
        <>
          <FlashSessionHeader
            baseName={getSelectedBaseName(selectedBaseId, bases)}
            onChangeBase={returnToBaseSelection}
          />

          <FlashDirectionToggle
            frontLanguage={frontLanguage}
            onChange={changeFrontLanguage}
          />

          <LoadingBar
            current={words.length === 0 ? 0 : currentIndex + 1}
            progress={progress}
            total={words.length}
          />

          {isLoadingWords && <FlashMessage>Ładowanie fiszek...</FlashMessage>}

          {error && <FlashMessage variant="error">{error}</FlashMessage>}

          {!isLoadingWords && !error && words.length === 0 && (
            <FlashMessage>Ta baza nie ma jeszcze słów.</FlashMessage>
          )}

          {currentWord && (
            <>
              <FlashCard
                frontLanguage={frontLanguage}
                isFlipped={isFlipped}
                word={currentWord}
                onFlip={() => setIsFlipped((currentValue) => !currentValue)}
                onRate={goToNextCard}
              />

              <FlashControls
                onNext={goToNextCard}
                onPrevious={goToPreviousCard}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function FlashPageDescription() {
  return (
    <section>
      <h1 className="text-5xl font-bold tracking-tight text-white">Fiszki</h1>

      <p className="mt-4 text-xl text-slate-400">
        Przeglądaj i oceniaj swoją znajomość słówek
      </p>
    </section>
  );
}

function BaseSelectionCard({ bases, isLoading, onSelectBase }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Wybierz bazę fiszek</h2>
        <p className="mt-2 text-slate-400">
          Zacznij od konkretnej bazy albo ćwicz wszystkie słowa naraz.
        </p>
      </div>

      {isLoading ? (
        <p className="text-slate-400">Ładowanie baz...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <button
            type="button"
            onClick={() => onSelectBase("all")}
            className="flex min-h-32 cursor-pointer flex-col items-start justify-between rounded-3xl border border-violet-500/40 bg-violet-600/15 p-5 text-left transition hover:scale-[1.03] hover:bg-violet-600/20"
          >
            <Layers className="h-7 w-7 text-violet-300" />
            <span>
              <span className="block text-xl font-bold text-white">
                Wszystkie
              </span>
              <span className="mt-1 block text-sm text-slate-400">
                Słowa ze wszystkich baz
              </span>
            </span>
          </button>

          {bases.map((base) => (
            <button
              key={base.id}
              type="button"
              onClick={() => onSelectBase(base.id.toString())}
              className="flex min-h-32 cursor-pointer flex-col items-start justify-between rounded-3xl border border-white/10 bg-slate-950/70 p-5 text-left transition hover:scale-[1.03] hover:border-violet-500/50 hover:bg-violet-500/10"
            >
              <Layers className="h-7 w-7 text-slate-500" />
              <span className="block break-words text-xl font-bold text-white">
                {base.name}
              </span>
            </button>
          ))}

          {bases.length === 0 && (
            <p className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 text-slate-400 md:col-span-2 xl:col-span-3">
              Brak baz. Utwórz bazę przy dodawaniu słów albo po skanie.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function FlashSessionHeader({ baseName, onChangeBase }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/80 p-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Aktualna baza
        </p>
        <h2 className="mt-1 text-2xl font-bold text-white">{baseName}</h2>
      </div>

      <button
        type="button"
        onClick={onChangeBase}
        className="rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20"
      >
        Zmień bazę
      </button>
    </section>
  );
}

function LoadingBar({ current, progress, total }) {
  return (
    <section className="flex items-center gap-6">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-violet-950/70">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <span className="text-lg font-medium text-slate-400">
        {current}/{total}
      </span>
    </section>
  );
}

function FlashDirectionToggle({ frontLanguage, onChange }) {
  const options = [
    { label: "Angielski", value: "english" },
    { label: "Polski", value: "polish" },
  ];

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/80 p-5">
      <div>
        <h2 className="text-lg font-bold text-white">Pierwsza strona fiszki</h2>
        <p className="mt-1 text-sm text-slate-400">
          Wybierz, od którego języka zaczynasz powtórkę.
        </p>
      </div>

      <div className="flex rounded-2xl bg-slate-950/80 p-1">
        {options.map((option) => {
          const active = frontLanguage === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-xl px-5 py-3 text-sm font-bold transition ${
                active
                  ? "bg-violet-600 text-white"
                  : "text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FlashCard({ frontLanguage, isFlipped, word, onFlip, onRate }) {
  const ratingButtons = ["Nie znam", "Słabo", "Dobrze", "Świetnie"];
  const frontLabel = frontLanguage === "english" ? "English" : "Polski";
  const backLabel = frontLanguage === "english" ? "Polski" : "English";
  const frontText = frontLanguage === "english" ? word.english : word.polish;
  const backText = frontLanguage === "english" ? word.polish : word.english;

  return (
    <section className="flex justify-center pt-6">
      <div
        role="button"
        tabIndex={0}
        onClick={onFlip}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onFlip();
          }
        }}
        className="w-full max-w-3xl text-left outline-none"
        style={{ perspective: "1200px" }}
      >
        <div
          className="relative min-h-[380px] rounded-[32px] transition-transform duration-500"
          style={{
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            transformStyle: "preserve-3d",
          }}
        >
          <CardFace>
            <p className="mb-8 text-sm uppercase tracking-[0.35em] text-slate-500">
              {frontLabel}
            </p>

            <h2 className="break-words text-center text-4xl font-bold tracking-tight text-white md:text-5xl">
              {frontText}
            </h2>

            <p className="mt-10 text-base text-slate-600">
              Kliknij aby odkryć
            </p>
          </CardFace>

          <CardFace isBack>
            <p className="mb-8 text-sm uppercase tracking-[0.35em] text-slate-500">
              {backLabel}
            </p>

            <h2 className="break-words text-center text-4xl font-bold tracking-tight text-white md:text-5xl">
              {backText}
            </h2>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {ratingButtons.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRate();
                  }}
                  className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${getRatingClassName(label)}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardFace>
        </div>
      </div>
    </section>
  );
}

function CardFace({ children, isBack = false }) {
  return (
    <div
      className={`absolute inset-0 flex min-h-[380px] flex-col items-center justify-center rounded-[32px] border border-white/10 p-8 text-center shadow-2xl md:p-10 ${
        isBack
          ? "bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900"
          : "bg-gradient-to-br from-violet-950/40 via-slate-900 to-slate-900"
      }`}
      style={{
        backfaceVisibility: "hidden",
        transform: isBack ? "rotateY(180deg)" : "rotateY(0deg)",
      }}
    >
      {children}
    </div>
  );
}

function FlashControls({ onNext, onPrevious }) {
  return (
    <section className="flex justify-center gap-4">
      <button
        type="button"
        onClick={onPrevious}
        className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20"
      >
        <ChevronLeft className="h-5 w-5" />
        Poprzednia
      </button>

      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-500"
      >
        Następna
        <ChevronRight className="h-5 w-5" />
      </button>
    </section>
  );
}

function FlashMessage({ children, variant = "default" }) {
  const className =
    variant === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-300"
      : "border-white/10 bg-slate-900/80 text-slate-400";

  return (
    <section className={`rounded-3xl border p-6 ${className}`}>
      {children}
    </section>
  );
}

function getSelectedBaseName(selectedBaseId, bases) {
  if (selectedBaseId === "all") return "Wszystkie";

  return bases.find((base) => base.id.toString() === selectedBaseId)?.name ?? "";
}

function getRatingClassName(label) {
  if (label === "Nie znam") return "bg-red-500/20 text-red-300 hover:bg-red-500/30";
  if (label === "Słabo") return "bg-orange-500/20 text-orange-300 hover:bg-orange-500/30";
  if (label === "Dobrze") return "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30";

  return "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30";
}
