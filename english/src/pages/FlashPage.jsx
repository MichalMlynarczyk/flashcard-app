import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  GraduationCap,
  Layers,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  deleteWordBase,
  fetchAllWords,
  fetchWordBases,
} from "../features/words/services/wordsApi";

export default function FlashPage() {
  const [bases, setBases] = useState([]);
  const [selectedBaseId, setSelectedBaseId] = useState(null);
  const [orderedWords, setOrderedWords] = useState([]);
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [frontLanguage, setFrontLanguage] = useState("english");
  const [isShuffled, setIsShuffled] = useState(false);
  const [sessionMode, setSessionMode] = useState(null);
  const [studySession, setStudySession] = useState(null);
  const [isLoadingBases, setIsLoadingBases] = useState(true);
  const [isLoadingWords, setIsLoadingWords] = useState(false);
  const [isDeletingBase, setIsDeletingBase] = useState(false);
  const [baseToDelete, setBaseToDelete] = useState(null);
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
    setOrderedWords([]);
    setWords([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionMode(null);
    setStudySession(null);

    try {
      const data = await fetchAllWords({
        baseId: baseId === "all" ? undefined : baseId,
      });

      setOrderedWords(data);
      setWords(isShuffled ? shuffleWords(data) : data);
    } catch (loadError) {
      console.error(loadError);
      setError("Nie udało się pobrać fiszek z bazy.");
    } finally {
      setIsLoadingWords(false);
    }
  }

  const currentWord = words[currentIndex];
  const studyStages = useMemo(
    () => buildStudyStages([...orderedWords].reverse()),
    [orderedWords]
  );
  const activeStudyStage = studySession
    ? studyStages[studySession.stageIndex]
    : null;
  const activeStudyWords = activeStudyStage ? activeStudyStage.words : [];
  const currentStudyWord =
    activeStudyWords.length > 0
      ? activeStudyWords[
          Math.min(studySession.currentIndex, activeStudyWords.length - 1)
        ]
      : null;
  const isCurrentStudyWordKnown = currentStudyWord
    ? studySession?.knownWordIds.includes(getWordKey(currentStudyWord))
    : false;
  const studyCardPositionLabel =
    studySession && activeStudyStage
      ? `${studySession.currentIndex + 1}/${activeStudyStage.words.length}`
      : "";
  const studyFrontLanguage = studySession?.roundIndex === 0 ? "polish" : "english";
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

  function changeShuffleMode(enabled) {
    setIsShuffled(enabled);
    setWords(enabled ? shuffleWords(words) : orderedWords);
    setCurrentIndex(0);
    setIsFlipped(false);
  }

  function startNormalMode() {
    setSessionMode("normal");
    setStudySession(null);
    setWords(isShuffled ? shuffleWords(orderedWords) : orderedWords);
    setCurrentIndex(0);
    setIsFlipped(false);
  }

  function startStudyMode() {
    if (studyStages.length === 0) return;

    setSessionMode("study");
    setStudySession({
      stageIndex: 0,
      roundIndex: 0,
      knownWordIds: [],
      currentIndex: 0,
      isComplete: false,
    });
    setIsFlipped(false);
  }

  function markStudyWordKnown() {
    if (!studySession || !currentStudyWord || !activeStudyStage) return;

    const wordKey = getWordKey(currentStudyWord);
    const nextKnownWordIds = studySession.knownWordIds.includes(wordKey)
      ? studySession.knownWordIds
      : [...studySession.knownWordIds, wordKey];
    const isRoundComplete =
      nextKnownWordIds.length >= activeStudyStage.words.length;

    if (!isRoundComplete) {
      setStudySession({
        ...studySession,
        knownWordIds: nextKnownWordIds,
        currentIndex: (studySession.currentIndex + 1) % activeStudyWords.length,
      });
      setIsFlipped(false);
      return;
    }

    if (studySession.roundIndex === 0) {
      setStudySession({
        ...studySession,
        roundIndex: 1,
        knownWordIds: [],
        currentIndex: 0,
      });
      setIsFlipped(false);
      return;
    }

    const nextStageIndex = studySession.stageIndex + 1;

    if (nextStageIndex >= studyStages.length) {
      setStudySession({
        ...studySession,
        knownWordIds: nextKnownWordIds,
        currentIndex: 0,
        isComplete: true,
      });
      setIsFlipped(false);
      return;
    }

    setStudySession({
      stageIndex: nextStageIndex,
      roundIndex: 0,
      knownWordIds: [],
      currentIndex: 0,
      isComplete: false,
    });
    setIsFlipped(false);
  }

  function goToNextStudyCard() {
    if (!studySession || activeStudyWords.length === 0) return;

    setStudySession({
      ...studySession,
      currentIndex: (studySession.currentIndex + 1) % activeStudyWords.length,
    });
    setIsFlipped(false);
  }

  function restartStudyMode() {
    startStudyMode();
  }

  function returnToBaseSelection() {
    setSelectedBaseId(null);
    setOrderedWords([]);
    setWords([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionMode(null);
    setStudySession(null);
    setError("");
  }

  function requestDeleteBase(base) {
    setBaseToDelete(base);
    setError("");
  }

  function cancelDeleteBase() {
    if (isDeletingBase) return;

    setBaseToDelete(null);
  }

  async function confirmDeleteBase() {
    if (!baseToDelete) return;

    setIsDeletingBase(true);
    setError("");

    try {
      await deleteWordBase(baseToDelete.id);
      setBases((currentBases) =>
        currentBases.filter((base) => base.id !== baseToDelete.id)
      );
      setBaseToDelete(null);
    } catch (deleteError) {
      console.error(deleteError);
      setError("Nie udało się usunąć bazy fiszek.");
    } finally {
      setIsDeletingBase(false);
    }
  }

  return (
    <div className="space-y-10">
      <FlashPageDescription />

      {selectedBaseId === null && (
        <>
          {error && <FlashMessage variant="error">{error}</FlashMessage>}

          <BaseSelectionCard
            bases={bases}
            isLoading={isLoadingBases}
            onDeleteBase={requestDeleteBase}
            onSelectBase={startFlashcards}
          />

          <DeleteBaseDialog
            base={baseToDelete}
            isDeleting={isDeletingBase}
            onCancel={cancelDeleteBase}
            onConfirm={confirmDeleteBase}
          />
        </>
      )}

      {selectedBaseId !== null && (
        <>
          <FlashSessionHeader
            baseName={getSelectedBaseName(selectedBaseId, bases)}
            onChangeBase={returnToBaseSelection}
          />

          {isLoadingWords && <FlashMessage>Ładowanie fiszek...</FlashMessage>}

          {error && <FlashMessage variant="error">{error}</FlashMessage>}

          {!isLoadingWords && !error && words.length === 0 && (
            <FlashMessage>Ta baza nie ma jeszcze słów.</FlashMessage>
          )}

          {!isLoadingWords &&
            !error &&
            words.length > 0 &&
            sessionMode === null && (
              <ModeSelectionCard
                onStartNormal={startNormalMode}
                onStartStudy={startStudyMode}
              />
            )}

          {sessionMode === "normal" && (
            <>
              <FlashDirectionToggle
                frontLanguage={frontLanguage}
                isShuffled={isShuffled}
                onChange={changeFrontLanguage}
                onShuffleChange={changeShuffleMode}
              />

              <LoadingBar
                current={words.length === 0 ? 0 : currentIndex + 1}
                progress={progress}
                total={words.length}
              />
            </>
          )}

          {sessionMode === "normal" && currentWord && (
            <>
              <FlashCard
                frontLanguage={frontLanguage}
                isFlipped={isFlipped}
                word={currentWord}
                onFlip={() => setIsFlipped((currentValue) => !currentValue)}
              />

              <FlashControls
                onNext={goToNextCard}
                onPrevious={goToPreviousCard}
              />
            </>
          )}

          {sessionMode === "study" && studySession?.isComplete && (
            <StudyCompleteCard onRestart={restartStudyMode} />
          )}

          {sessionMode === "study" &&
            !studySession?.isComplete &&
            activeStudyStage &&
            currentStudyWord && (
              <>
                <StudySessionPanel
                  frontLanguage={studyFrontLanguage}
                  knownCount={studySession.knownWordIds.length}
                  roundIndex={studySession.roundIndex}
                  stage={activeStudyStage}
                  stageIndex={studySession.stageIndex}
                  stagesTotal={studyStages.length}
                />

                <FlashCard
                  cardPositionLabel={studyCardPositionLabel}
                  frontLanguage={studyFrontLanguage}
                  isFlipped={isFlipped}
                  isKnown={isCurrentStudyWordKnown}
                  onKnown={markStudyWordKnown}
                  word={currentStudyWord}
                  onFlip={() => setIsFlipped((currentValue) => !currentValue)}
                />

                <StudyControls onNext={goToNextStudyCard} />
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

      <p className="mt-4 text-xl text-[#9aa8bc]">
        Przeglądaj i oceniaj swoją znajomość słówek
      </p>
    </section>
  );
}

function BaseSelectionCard({ bases, isLoading, onDeleteBase, onSelectBase }) {
  return (
    <section className="rounded-3xl border border-[#40506a] bg-[#1c2636]/90 p-6 shadow-xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Wybierz bazę fiszek</h2>
        <p className="mt-2 text-[#9aa8bc]">
          Zacznij od konkretnej bazy albo ćwicz wszystkie słowa naraz.
        </p>
      </div>

      {isLoading ? (
        <p className="text-[#9aa8bc]">Ładowanie baz...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <button
            type="button"
            onClick={() => onSelectBase("all")}
            className="flex min-h-32 cursor-pointer flex-col items-start justify-between rounded-3xl border border-[#78b7ee]/50 bg-[#78b7ee]/15 p-5 text-left transition hover:scale-[1.03] hover:bg-[#78b7ee]/20"
          >
            <Layers className="h-7 w-7 text-[#9ed0ff]" />
            <span>
              <span className="block text-xl font-bold text-white">
                Wszystkie
              </span>
              <span className="mt-1 block text-sm text-[#9aa8bc]">
                Słowa ze wszystkich baz
              </span>
            </span>
          </button>

          {bases.map((base) => (
            <article
              key={base.id}
              className="group relative min-h-32 rounded-3xl border border-[#40506a] bg-[#111827]/70 transition hover:scale-[1.03] hover:border-[#78b7ee]/65 hover:bg-[#78b7ee]/12"
            >
              <button
                type="button"
                onClick={() => onSelectBase(base.id.toString())}
                className="flex h-full min-h-32 w-full cursor-pointer flex-col items-start justify-between rounded-3xl p-5 pr-16 text-left"
              >
                <Layers className="h-7 w-7 text-[#74849a]" />
                <span className="block break-words text-xl font-bold text-white">
                  {base.name}
                </span>
              </button>

              {base.id !== 0 && (
                <button
                  type="button"
                  onClick={() => onDeleteBase(base)}
                  className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#78b7ee]/12 text-[#9aa8bc] opacity-100 transition hover:bg-red-500/15 hover:text-red-300 md:opacity-0 md:group-hover:opacity-100"
                  aria-label={`Usuń bazę ${base.name}`}
                  title="Usuń bazę"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </article>
          ))}

          {bases.length === 0 && (
            <p className="rounded-3xl border border-[#40506a] bg-[#111827]/70 p-5 text-[#9aa8bc] md:col-span-2 xl:col-span-3">
              Brak baz. Utwórz bazę przy dodawaniu słów albo po skanie.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function DeleteBaseDialog({ base, isDeleting, onCancel, onConfirm }) {
  if (!base) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/75 p-4 backdrop-blur">
      <section className="w-full max-w-md rounded-3xl border border-red-500/20 bg-[#111827] p-6 text-white shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
              <AlertTriangle className="h-6 w-6" />
            </span>

            <div>
              <h2 className="text-xl font-bold">Usunąć bazę?</h2>
              <p className="mt-2 text-sm leading-6 text-[#9aa8bc]">
                Baza <span className="font-semibold text-white">{base.name}</span>{" "}
                oraz wszystkie jej słowa zostaną trwale usunięte.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#78b7ee]/12 text-[#c5d3e4] transition hover:bg-[#78b7ee]/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-2xl bg-[#78b7ee]/12 px-5 py-3 font-semibold text-white transition hover:bg-[#78b7ee]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anuluj
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-5 w-5" />
            {isDeleting ? "Usuwanie..." : "Usuń bazę"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ModeSelectionCard({ onStartNormal, onStartStudy }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <button
        type="button"
        onClick={onStartNormal}
        className="flex min-h-44 flex-col items-start justify-between rounded-3xl border border-[#40506a] bg-[#1c2636]/90 p-6 text-left shadow-xl transition hover:scale-[1.02] hover:border-[#78b7ee]/65 hover:bg-[#78b7ee]/12"
      >
        <Layers className="h-8 w-8 text-[#9ed0ff]" />
        <span>
          <span className="block text-2xl font-bold text-white">
            Tryb normalny
          </span>
          <span className="mt-2 block text-sm leading-6 text-[#9aa8bc]">
            Klasyczne przeglądanie całej wybranej bazy fiszek.
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onStartStudy}
        className="flex min-h-44 flex-col items-start justify-between rounded-3xl border border-[#6f4d73]/70 bg-[#351f34]/80 p-6 text-left shadow-xl transition hover:scale-[1.02] hover:border-[#78b7ee]/65 hover:bg-[#432743]/90"
      >
        <GraduationCap className="h-8 w-8 text-[#9ed0ff]" />
        <span>
          <span className="block text-2xl font-bold text-white">
            Tryb nauka
          </span>
          <span className="mt-2 block text-sm leading-6 text-[#9aa8bc]">
            Paczki po 5 kart, dwie rundy językowe i powtórki 10/20.
          </span>
        </span>
      </button>
    </section>
  );
}

function FlashSessionHeader({ baseName, onChangeBase }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#40506a] bg-[#1c2636]/90 p-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#74849a]">
          Aktualna baza
        </p>
        <h2 className="mt-1 text-2xl font-bold text-white">{baseName}</h2>
      </div>

      <button
        type="button"
        onClick={onChangeBase}
        className="rounded-2xl bg-[#78b7ee]/12 px-5 py-3 font-semibold text-white transition hover:bg-[#78b7ee]/20"
      >
        Zmień bazę
      </button>
    </section>
  );
}

function StudySessionPanel({
  frontLanguage,
  knownCount,
  roundIndex,
  stage,
  stageIndex,
  stagesTotal,
}) {
  const frontLabel = frontLanguage === "polish" ? "PL -> ENG" : "ENG -> PL";
  const roundLabel = roundIndex === 0 ? "Pierwsza tura" : "Druga tura";

  return (
    <section className="grid gap-4 rounded-3xl border border-[#40506a] bg-[#1c2636]/90 p-5 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9ed0ff]">
          Tryb nauka
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">{stage.label}</h2>
        <p className="mt-2 text-sm text-[#9aa8bc]">
          Etap {stageIndex + 1}/{stagesTotal} · {roundLabel} · {frontLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:flex">
        <StudyStat label="Znam" value={`${knownCount}/${stage.words.length}`} />
        <StudyStat label="Zakres" value={stage.rangeLabel} />
      </div>
    </section>
  );
}

function StudyStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-[#111827]/70 px-4 py-3">
      <p className="text-xs font-semibold uppercase text-[#74849a]">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function StudyControls({ onNext }) {
  return (
    <section className="flex flex-wrap justify-center gap-4">
      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center gap-2 rounded-2xl bg-[#78b7ee]/12 px-5 py-3 font-semibold text-white transition hover:bg-[#78b7ee]/20"
      >
        Następna
        <ChevronRight className="h-5 w-5" />
      </button>
    </section>
  );
}

function StudyCompleteCard({ onRestart }) {
  return (
    <section className="rounded-3xl border border-[#78b7ee]/45 bg-[#1c2636]/90 p-7 text-center shadow-xl">
      <CheckCircle2 className="mx-auto h-12 w-12 text-[#9ed0ff]" />
      <h2 className="mt-4 text-2xl font-bold text-white">
        Cykl nauki ukończony
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-[#9aa8bc]">
        Wszystkie dostępne paczki i powtórki zostały oznaczone jako znane w obu
        kierunkach.
      </p>
      <button
        type="button"
        onClick={onRestart}
        className="mt-6 rounded-2xl bg-[#78b7ee] px-5 py-3 font-semibold text-white transition hover:bg-[#8cc5f4]"
      >
        Zacznij cykl od nowa
      </button>
    </section>
  );
}

function LoadingBar({ current, progress, total }) {
  return (
    <section className="flex items-center gap-6">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#20324a]/80">
        <div
          className="h-full rounded-full bg-[#8cc5f4] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <span className="text-lg font-medium text-[#9aa8bc]">
        {current}/{total}
      </span>
    </section>
  );
}

function FlashDirectionToggle({
  frontLanguage,
  isShuffled,
  onChange,
  onShuffleChange,
}) {
  const options = [
    { label: "Angielski", value: "english" },
    { label: "Polski", value: "polish" },
  ];

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#40506a] bg-[#1c2636]/90 p-5">
      <div>
        <h2 className="text-lg font-bold text-white">Pierwsza strona fiszki</h2>
        <p className="mt-1 text-sm text-[#9aa8bc]">
          Wybierz, od którego języka zaczynasz powtórkę.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-2xl bg-[#111827]/80 p-1">
          {options.map((option) => {
            const active = frontLanguage === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={`rounded-xl px-5 py-3 text-sm font-bold transition ${
                  active
                    ? "bg-[#78b7ee] text-white"
                    : "text-[#9aa8bc] hover:bg-[#78b7ee]/12 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-[#111827]/80 px-4 py-3 text-sm font-bold text-[#c5d3e4] transition hover:bg-[#78b7ee]/12 hover:text-white">
          <input
            type="checkbox"
            checked={isShuffled}
            onChange={(event) => onShuffleChange(event.target.checked)}
            className="sr-only"
          />
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
              isShuffled ? "bg-[#78b7ee] text-white" : "bg-[#78b7ee]/12"
            }`}
          >
            <Shuffle className="h-5 w-5" />
          </span>
          Mieszaj fiszki
        </label>
      </div>
    </section>
  );
}

function FlashCard({
  cardPositionLabel,
  frontLanguage,
  isFlipped,
  isKnown = false,
  onFlip,
  onKnown,
  word,
}) {
  const frontLabel = frontLanguage === "english" ? "English" : "Polski";
  const backLabel = frontLanguage === "english" ? "Polski" : "English";
  const frontText = frontLanguage === "english" ? word.english : word.polish;
  const backText = frontLanguage === "english" ? word.polish : word.english;
  const knownButton = onKnown ? (
    <KnownButton isKnown={isKnown} onKnown={onKnown} />
  ) : null;

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
          <CardFace
            cardPositionLabel={cardPositionLabel}
            isKnown={isKnown}
          >
            <p className="mb-8 text-sm uppercase tracking-[0.35em] text-[#74849a]">
              {frontLabel}
            </p>

            <FlashCardText>{frontText}</FlashCardText>
            {knownButton}

            <p className="mt-10 text-base text-[#607086]">
              Kliknij aby odkryć
            </p>
          </CardFace>

          <CardFace
            cardPositionLabel={cardPositionLabel}
            isBack
            isKnown={isKnown}
          >
            <p className="mb-8 text-sm uppercase tracking-[0.35em] text-[#74849a]">
              {backLabel}
            </p>

            <FlashCardText>{backText}</FlashCardText>
            {knownButton}
          </CardFace>
        </div>
      </div>
    </section>
  );
}

function KnownButton({ isKnown, onKnown }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onKnown();
      }}
      className={`mt-8 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition ${
        isKnown
          ? "bg-amber-400 text-[#111827] shadow-lg shadow-amber-500/20 hover:bg-amber-300"
          : "bg-[#78b7ee] text-white hover:bg-[#8cc5f4]"
      }`}
    >
      <CheckCircle2 className="h-5 w-5" />
      {isKnown ? "Znam" : "Znam"}
    </button>
  );
}

function FlashCardText({ children }) {
  const textLength = children?.toString().length ?? 0;
  const sizeClassName =
    textLength > 80
      ? "text-2xl md:text-3xl"
      : textLength > 45
        ? "text-3xl md:text-4xl"
        : "text-4xl md:text-5xl";

  return (
    <h2
      className={`max-h-52 w-full max-w-full overflow-y-auto whitespace-normal px-1 text-center font-bold leading-tight text-white [overflow-wrap:anywhere] md:max-h-60 ${sizeClassName}`}
    >
      {children}
    </h2>
  );
}

function CardFace({
  cardPositionLabel,
  children,
  isBack = false,
  isKnown = false,
}) {
  return (
    <div
      className={`absolute inset-0 flex min-h-[380px] flex-col items-center justify-center rounded-[32px] border p-8 text-center shadow-2xl md:p-10 ${
        isKnown
          ? "border-amber-300/80 shadow-amber-500/20"
          : "border-[#40506a]"
      } ${
        isKnown
          ? "bg-gradient-to-br from-[#3d2f1f]/50 via-[#1c2636] to-[#1c2636]"
          : isBack
            ? "bg-gradient-to-br from-[#1d3342]/45 via-[#1c2636] to-[#1c2636]"
            : "bg-gradient-to-br from-[#243d5a]/45 via-[#1c2636] to-[#1c2636]"
      }`}
      style={{
        backfaceVisibility: "hidden",
        transform: isBack ? "rotateY(180deg)" : "rotateY(0deg)",
      }}
    >
      {cardPositionLabel && (
        <span
          className={`absolute right-6 top-6 rounded-full px-3 py-1 text-sm font-bold ${
            isKnown
              ? "bg-amber-300 text-[#111827]"
              : "bg-[#78b7ee]/12 text-[#c5d3e4]"
          }`}
        >
          {cardPositionLabel}
        </span>
      )}
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
        className="inline-flex items-center gap-2 rounded-2xl bg-[#78b7ee]/12 px-5 py-3 font-semibold text-white transition hover:bg-[#78b7ee]/20"
      >
        <ChevronLeft className="h-5 w-5" />
        Poprzednia
      </button>

      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center gap-2 rounded-2xl bg-[#78b7ee] px-5 py-3 font-semibold text-white transition hover:bg-[#8cc5f4]"
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
      : "border-[#40506a] bg-[#1c2636]/90 text-[#9aa8bc]";

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

function buildStudyStages(words) {
  const stages = [];

  for (let blockStart = 0; blockStart < words.length; blockStart += 20) {
    const blockWords = words.slice(blockStart, blockStart + 20);
    const blockNumber = Math.floor(blockStart / 20) + 1;

    for (let pairStart = 0; pairStart < blockWords.length; pairStart += 10) {
      const firstFive = blockWords.slice(pairStart, pairStart + 5);
      const secondFive = blockWords.slice(pairStart + 5, pairStart + 10);
      const tenWords = blockWords.slice(pairStart, pairStart + 10);

      if (firstFive.length > 0) {
        stages.push(
          createStudyStage({
            blockNumber,
            kind: "new",
            offset: blockStart + pairStart,
            words: firstFive,
          })
        );
      }

      if (secondFive.length > 0) {
        stages.push(
          createStudyStage({
            blockNumber,
            kind: "new",
            offset: blockStart + pairStart + 5,
            words: secondFive,
          })
        );
      }

      if (tenWords.length > 5) {
        stages.push(
          createStudyStage({
            blockNumber,
            kind: "review",
            offset: blockStart + pairStart,
            words: tenWords,
          })
        );
      }
    }

    if (blockWords.length > 10) {
      stages.push(
        createStudyStage({
          blockNumber,
          kind: "review",
          offset: blockStart,
          words: blockWords,
        })
      );
    }
  }

  return stages;
}

function createStudyStage({ blockNumber, kind, offset, words }) {
  const start = offset + 1;
  const end = offset + words.length;
  const rangeLabel = `${start}-${end}`;
  const prefix = kind === "new" ? "Nowe fiszki" : "Powtórka";

  return {
    blockNumber,
    label: `${prefix} ${rangeLabel}`,
    rangeLabel,
    words,
  };
}

function getWordKey(word) {
  return word.id ?? `${word.english}:${word.polish}`;
}

function shuffleWords(words) {
  const shuffledWords = [...words];

  for (let index = shuffledWords.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledWords[index], shuffledWords[randomIndex]] = [
      shuffledWords[randomIndex],
      shuffledWords[index],
    ];
  }

  return shuffledWords;
}
