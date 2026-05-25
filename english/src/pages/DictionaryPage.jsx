import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  deleteWords,
  fetchWordBases,
  fetchWords,
  updateWord,
} from "../features/words/services/wordsApi";

export default function DictionaryPage() {
  const [words, setWords] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [bases, setBases] = useState([]);
  const [selectedBaseId, setSelectedBaseId] = useState("");
  const [selectedWordIds, setSelectedWordIds] = useState([]);
  const [editingWordId, setEditingWordId] = useState(null);
  const [editEnglish, setEditEnglish] = useState("");
  const [editPolish, setEditPolish] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");

  async function loadWords(page = pagination.page) {
    setIsLoading(true);
    setError("");

    try {
      const data = await fetchWords({
        baseId: selectedBaseId,
        page,
        perPage: pagination.perPage,
        search,
      });

      const nextPage = Math.min(page, data.pagination.totalPages);

      if (page !== nextPage) {
        setPagination((currentPagination) => ({
          ...currentPagination,
          page: nextPage,
        }));
        return;
      }

      setWords(data.words);
      setSelectedWordIds([]);
      setEditingWordId(null);
      setPagination(data.pagination);
    } catch (loadError) {
      console.error(loadError);
      setError("Nie udało się pobrać słów z bazy.");
    } finally {
      setIsLoading(false);
    }
  }

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
        }
      }
    }

    loadBases();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadCurrentWords() {
      setIsLoading(true);
      setError("");

      try {
        const data = await fetchWords({
          baseId: selectedBaseId,
          page: pagination.page,
          perPage: pagination.perPage,
          search,
        });

        if (ignore) return;

        setWords(data.words);
        setSelectedWordIds([]);
        setEditingWordId(null);
        setPagination(data.pagination);
      } catch (loadError) {
        if (ignore) return;

        console.error(loadError);
        setError("Nie udało się pobrać słów z bazy.");
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadCurrentWords();

    return () => {
      ignore = true;
    };
  }, [pagination.page, pagination.perPage, search, selectedBaseId]);

  function handleSearchChange(event) {
    setSearch(event.target.value);
    setPagination((currentPagination) => ({
      ...currentPagination,
      page: 1,
    }));
  }

  function handlePerPageChange(event) {
    setPagination((currentPagination) => ({
      ...currentPagination,
      page: 1,
      perPage: Number(event.target.value),
    }));
  }

  function handleBaseChange(event) {
    setSelectedBaseId(event.target.value);
    setPagination((currentPagination) => ({
      ...currentPagination,
      page: 1,
    }));
  }

  function goToPage(page) {
    setPagination((currentPagination) => ({
      ...currentPagination,
      page: Math.min(Math.max(page, 1), currentPagination.totalPages),
    }));
  }

  function toggleWordSelection(wordId) {
    setSelectedWordIds((currentIds) => {
      const isSelected = currentIds.includes(wordId);

      if (editingWordId && (editingWordId !== wordId || isSelected)) {
        setEditingWordId(null);
      }

      return isSelected
        ? currentIds.filter((id) => id !== wordId)
        : [...currentIds, wordId];
    });
  }

  function togglePageSelection() {
    const pageWordIds = words.map((word) => word.id);
    const allPageWordsSelected = pageWordIds.every((id) =>
      selectedWordIds.includes(id)
    );

    setSelectedWordIds(allPageWordsSelected ? [] : pageWordIds);
  }

  async function handleDeleteSelectedWords() {
    if (selectedWordIds.length === 0) return;

    const confirmed = window.confirm(
      `Usunąć zaznaczone słowa (${selectedWordIds.length})?`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    setError("");

    try {
      await deleteWords(selectedWordIds);
      await loadWords(pagination.page);
    } catch (deleteError) {
      console.error(deleteError);
      setError("Nie udało się usunąć zaznaczonych słów.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleEditSelectedWord() {
    if (selectedWordIds.length !== 1) return;

    const selectedWord = words.find((word) => word.id === selectedWordIds[0]);

    if (!selectedWord) return;

    setEditingWordId(selectedWord.id);
    setEditEnglish(selectedWord.english);
    setEditPolish(selectedWord.polish);
    setError("");
  }

  async function handleSaveEditedWord(event) {
    event.preventDefault();

    if (!editingWordId) return;

    if (!editEnglish.trim() || !editPolish.trim()) {
      setError("Słowo i tłumaczenie nie mogą być puste.");
      return;
    }

    setIsEditing(true);
    setError("");

    try {
      await updateWord(editingWordId, {
        english: editEnglish.trim(),
        polish: editPolish.trim(),
      });

      setEditingWordId(null);
      setEditEnglish("");
      setEditPolish("");
      await loadWords(pagination.page);
    } catch (editError) {
      console.error(editError);
      setError("Nie udało się edytować słowa.");
    } finally {
      setIsEditing(false);
    }
  }

  function cancelEditing() {
    setEditingWordId(null);
    setEditEnglish("");
    setEditPolish("");
  }

  return (
    <div className="min-w-0 space-y-8">
      <DictionaryPageDescription totalWords={pagination.total} />

      <FilterBar
        bases={bases}
        perPage={pagination.perPage}
        search={search}
        selectedBaseId={selectedBaseId}
        onBaseChange={handleBaseChange}
        onPerPageChange={handlePerPageChange}
        onSearchChange={handleSearchChange}
      />

      <SelectionToolbar
        allSelected={words.length > 0 && selectedWordIds.length === words.length}
        isDeleting={isDeleting}
        selectedCount={selectedWordIds.length}
        wordsCount={words.length}
        onDeleteSelected={handleDeleteSelectedWords}
        onEditSelected={handleEditSelectedWord}
        onTogglePageSelection={togglePageSelection}
      />

      <Dictionary
        error={error}
        editEnglish={editEnglish}
        editPolish={editPolish}
        editingWordId={editingWordId}
        isEditing={isEditing}
        isLoading={isLoading}
        selectedWordIds={selectedWordIds}
        words={words}
        onCancelEditing={cancelEditing}
        onEditEnglishChange={setEditEnglish}
        onEditPolishChange={setEditPolish}
        onSaveEditedWord={handleSaveEditedWord}
        onToggleWordSelection={toggleWordSelection}
      />

      <Pagination
        page={pagination.page}
        perPage={pagination.perPage}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onPageChange={goToPage}
      />
    </div>
  );
}

function SelectionToolbar({
  allSelected,
  isDeleting,
  selectedCount,
  wordsCount,
  onDeleteSelected,
  onEditSelected,
  onTogglePageSelection,
}) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex items-center gap-3 text-sm font-semibold text-slate-300">
        <input
          type="checkbox"
          checked={allSelected}
          disabled={wordsCount === 0}
          onChange={onTogglePageSelection}
          className="h-5 w-5 rounded border-white/10 bg-slate-950 accent-violet-600"
        />
        Zaznacz wszystkie na stronie
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-slate-400">
          Zaznaczono: {selectedCount}
        </span>

        {selectedCount > 0 && (
          <>
            <button
              type="button"
              onClick={onEditSelected}
              disabled={selectedCount !== 1 || isDeleting}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pencil className="h-5 w-5" />
              Edytuj
            </button>

            <button
              type="button"
              onClick={onDeleteSelected}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 rounded-2xl bg-red-600/80 px-5 py-3 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-5 w-5" />
              {isDeleting ? "Usuwanie..." : "Usuń"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function DictionaryPageDescription({ totalWords }) {
  return (
    <section>
      <h1 className="text-5xl font-bold text-white">Słownik</h1>

      <p className="mt-3 text-xl text-slate-400">
        Wszystkie Twoje słowa w jednym miejscu — {totalWords} słów
      </p>
    </section>
  );
}

function FilterBar({
  bases,
  perPage,
  search,
  selectedBaseId,
  onBaseChange,
  onPerPageChange,
  onSearchChange,
}) {
  return (
    <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-5 py-4">
        <Search className="h-5 w-5 shrink-0 text-slate-500" />

        <input
          type="text"
          value={search}
          onChange={onSearchChange}
          placeholder="Szukaj słowa lub tłumaczenia..."
          className="w-full bg-transparent outline-none placeholder:text-slate-500"
        />
      </div>

      <label className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900 px-5 py-4 text-slate-300">
        Baza
        <select
          value={selectedBaseId}
          onChange={onBaseChange}
          className="min-w-0 max-w-44 bg-transparent font-semibold text-white outline-none"
        >
          <option className="bg-slate-900" value="">
            Wszystkie
          </option>
          {bases.map((base) => (
            <option className="bg-slate-900" key={base.id} value={base.id}>
              {base.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900 px-5 py-4 text-slate-300">
        Na stronę
        <select
          value={perPage}
          onChange={onPerPageChange}
          className="bg-transparent font-semibold text-white outline-none"
        >
          <option className="bg-slate-900" value={20}>
            20
          </option>
          <option className="bg-slate-900" value={30}>
            30
          </option>
        </select>
      </label>
    </section>
  );
}

function Dictionary({
  error,
  editEnglish,
  editPolish,
  editingWordId,
  isEditing,
  isLoading,
  selectedWordIds,
  words,
  onCancelEditing,
  onEditEnglishChange,
  onEditPolishChange,
  onSaveEditedWord,
  onToggleWordSelection,
}) {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-slate-400">
        Ładowanie słów...
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
        {error}
      </section>
    );
  }

  if (words.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-slate-400">
        Brak słów do wyświetlenia.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {words.map((item) => {
        const selected = selectedWordIds.includes(item.id);
        const isEditingThisWord = editingWordId === item.id;

        return (
        <div
          key={item.id}
          onClick={() => onToggleWordSelection(item.id)}
          className={`relative w-full min-w-0 cursor-pointer rounded-3xl border p-5 text-left transition duration-200 sm:p-6 sm:hover:scale-[1.02] ${
            selected
              ? "border-violet-500/50 bg-violet-500/10 ring-2 ring-violet-500/20"
              : "border-white/10 bg-slate-900/80"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="min-w-0 text-2xl font-bold [overflow-wrap:anywhere]">
                  {item.english}
                </h3>

                <Camera className="h-4 w-4 shrink-0 text-slate-500" />
              </div>

              <p className="mt-2 min-w-0 text-3xl text-slate-400 [overflow-wrap:anywhere]">
                {item.polish}
              </p>
            </div>

            <span className="w-fit max-w-full shrink-0 rounded-full bg-violet-500/20 px-4 py-2 text-sm font-bold text-violet-300 [overflow-wrap:anywhere]">
              {item.baseName}
            </span>
          </div>

          {isEditingThisWord && (
            <form
              className="mt-6 grid gap-4 border-t border-white/10 pt-6"
              onClick={(event) => event.stopPropagation()}
              onSubmit={onSaveEditedWord}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">
                    Słowo po angielsku
                  </span>
                  <input
                    type="text"
                    value={editEnglish}
                    onChange={(event) => onEditEnglishChange(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-500"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">
                    Tłumaczenie po polsku
                  </span>
                  <input
                    type="text"
                    value={editPolish}
                    onChange={(event) => onEditPolishChange(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-500"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onCancelEditing}
                  className="rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20"
                >
                  Anuluj
                </button>

                <button
                  type="submit"
                  disabled={isEditing}
                  className="rounded-2xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEditing ? "Zapisywanie..." : "Zapisz zmiany"}
                </button>
              </div>
            </form>
          )}
        </div>
        );
      })}
    </section>
  );
}

function Pagination({ page, perPage, total, totalPages, onPageChange }) {
  if (total === 0) return null;

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <section className="grid gap-4 rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <p className="text-sm font-medium text-slate-400">
        Pokazano {start}-{end} z {total}
      </p>

      <div className="grid min-w-0 grid-cols-2 gap-3 sm:flex sm:items-center">
        <span className="col-span-2 text-center text-sm font-semibold text-slate-300 sm:order-2 sm:min-w-20">
          {page}/{totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 py-3 font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:order-1 sm:px-4"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="truncate">Poprzednia</span>
        </button>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-3 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:order-3 sm:px-4"
        >
          <span className="truncate">Następna</span>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}
