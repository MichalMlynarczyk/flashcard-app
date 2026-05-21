import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchBooks,
  fetchBookPageWords,
  getBookPagePreviewUrl,
} from "../features/books/services/booksApi";
import {
  createWord,
  translateWord,
} from "../features/words/services/wordsApi";

const BOOKMARKS_STORAGE_KEY = "brainlift-bookmarks";
const MIN_PAGE_ZOOM = 0.75;
const MAX_PAGE_ZOOM = 2.5;
const PAGE_ZOOM_STEP = 0.25;
const WORD_POPUP_WIDTH = 352;
const WORD_POPUP_ESTIMATED_HEIGHT = 300;
const WORD_POPUP_MARGIN = 12;

export default function BookPage() {
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [bookmarks, setBookmarks] = useState(() => loadBookmarks());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadBooks() {
      try {
        const data = await fetchBooks();

        if (!ignore) {
          setBooks(data.books);
        }
      } catch (loadError) {
        if (!ignore) {
          console.error(loadError);
          setError("Nie udało się pobrać książek.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadBooks();

    return () => {
      ignore = true;
    };
  }, []);

  function openBook(book) {
    setSelectedBook(book);
    setCurrentPage(bookmarks[book.filename] ?? 1);
  }

  function closePreview() {
    setSelectedBook(null);
    setCurrentPage(1);
  }

  function changePage(nextPage) {
    if (!selectedBook) return;

    const pageCount = selectedBook.pageCount || 1;
    setCurrentPage(Math.min(Math.max(nextPage, 1), pageCount));
  }

  function addBookmark() {
    if (!selectedBook) return;

    setBookmarks((currentBookmarks) => {
      const nextBookmarks = {
        ...currentBookmarks,
        [selectedBook.filename]: currentPage,
      };

      localStorage.setItem(
        BOOKMARKS_STORAGE_KEY,
        JSON.stringify(nextBookmarks)
      );

      return nextBookmarks;
    });
  }

  if (selectedBook) {
    return (
      <BookPreview
        book={selectedBook}
        bookmarkedPage={bookmarks[selectedBook.filename]}
        currentPage={currentPage}
        onAddBookmark={addBookmark}
        onBackToBooks={closePreview}
        onChangePage={changePage}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-5xl font-bold tracking-tight text-white">
          Książki
        </h1>

        <p className="mt-4 text-xl text-slate-400">
          Wybierz książkę, a potem podejrzyj pojedynczą stronę PDF.
        </p>
      </section>

      {isLoading && (
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-slate-400">
          Ładowanie książek...
        </section>
      )}

      {error && (
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
          {error}
        </section>
      )}

      {!isLoading && !error && (
        <section className="grid gap-5 md:grid-cols-2">
          {books.map((book) => (
            <article
              key={book.filename}
              className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 transition hover:border-violet-500/50 hover:bg-violet-500/10"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15">
                  <BookOpen className="h-6 w-6 text-violet-300" />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-xl font-bold text-white">
                    {book.title}
                  </h2>

                  <p className="mt-2 break-words text-sm text-slate-500">
                    {book.filename}
                  </p>

                  <p className="mt-2 text-sm font-medium text-slate-400">
                    {book.pageCount || "?"} stron
                  </p>

                  {bookmarks[book.filename] && (
                    <p className="mt-2 text-sm font-medium text-violet-300">
                      Zakładka: strona {bookmarks[book.filename]}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openBook(book)}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-500"
              >
                <Eye className="h-5 w-5" />
                Podgląd
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function BookPreview({
  book,
  bookmarkedPage,
  currentPage,
  onAddBookmark,
  onBackToBooks,
  onChangePage,
}) {
  const pageCount = book.pageCount || 1;
  const previewUrl = getBookPagePreviewUrl(book.filename, currentPage);
  const pageFrameRef = useRef(null);
  const pageViewportRef = useRef(null);
  const panRef = useRef({
    isDragging: false,
    lastDragEndedAt: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
    startX: 0,
    startY: 0,
    wasDragged: false,
  });
  const translationRequestRef = useRef(0);
  const [pageWords, setPageWords] = useState([]);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [pageViewportWidth, setPageViewportWidth] = useState(0);
  const [selectedWord, setSelectedWord] = useState(null);
  const [polish, setPolish] = useState("");
  const [isTranslatingWord, setIsTranslatingWord] = useState(false);
  const [isLoadingWords, setIsLoadingWords] = useState(false);
  const [isSavingWord, setIsSavingWord] = useState(false);
  const [readerError, setReaderError] = useState("");
  const [pageZoom, setPageZoom] = useState(1);
  const [pageJumpInput, setPageJumpInput] = useState({
    page: currentPage,
    value: currentPage.toString(),
  });
  const [isPanningPage, setIsPanningPage] = useState(false);
  const pageBaseWidth =
    pageSize.width > 0 && pageViewportWidth > 0
      ? Math.min(pageSize.width, pageViewportWidth)
      : pageSize.width;
  const pageRenderedWidth = pageBaseWidth ? pageBaseWidth * pageZoom : 0;
  const pageJumpValue =
    pageJumpInput.page === currentPage
      ? pageJumpInput.value
      : currentPage.toString();
  const isCurrentPageBookmarked = bookmarkedPage === currentPage;

  useEffect(() => {
    let ignore = false;

    async function loadPageWords() {
      setIsLoadingWords(true);
      setReaderError("");
      setSelectedWord(null);
      setPolish("");
      setIsTranslatingWord(false);

      try {
        const data = await fetchBookPageWords(book.filename, currentPage);

        if (!ignore) {
          setPageWords(data.words);
          setPageSize({ width: data.width, height: data.height });
        }
      } catch (loadError) {
        if (!ignore) {
          console.error(loadError);
          setReaderError("Nie udało się odczytać słów z tej strony.");
          setPageWords([]);
        }
      } finally {
        if (!ignore) {
          setIsLoadingWords(false);
        }
      }
    }

    loadPageWords();

    return () => {
      ignore = true;
    };
  }, [book.filename, currentPage]);

  useEffect(() => {
    const viewport = pageViewportRef.current;

    if (!viewport) return undefined;

    function updateViewportWidth() {
      setPageViewportWidth(viewport.clientWidth);
    }

    updateViewportWidth();

    const observer = new ResizeObserver(updateViewportWidth);
    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, []);

  async function saveSelectedWord(event) {
    event.preventDefault();

    if (!selectedWord) return;

    if (!polish.trim()) {
      setReaderError("Uzupełnij tłumaczenie.");
      return;
    }

    setIsSavingWord(true);
    setReaderError("");

    try {
      await createWord({
        english: selectedWord.text,
        polish: polish.trim(),
        baseName: book.title,
      });

      setSelectedWord(null);
      setPolish("");

    } catch (saveError) {
      console.error(saveError);
      setReaderError("Nie udało się dodać słowa do fiszek.");
    } finally {
      setIsSavingWord(false);
    }
  }

  function changePageZoom(nextZoom) {
    cancelSelectedWord();
    setPageZoom(
      Math.min(
        Math.max(nextZoom, MIN_PAGE_ZOOM),
        MAX_PAGE_ZOOM
      )
    );
  }

  function cancelSelectedWord() {
    translationRequestRef.current += 1;
    setSelectedWord(null);
    setPolish("");
    setIsTranslatingWord(false);
    setReaderError("");
  }

  function goToPage(event) {
    event.preventDefault();

    const requestedPage = Number(pageJumpValue);

    if (!Number.isInteger(requestedPage)) {
      setReaderError("Wpisz poprawny numer strony.");
      return;
    }

    setReaderError("");
    onChangePage(requestedPage);
  }

  function goToBookmark() {
    if (!bookmarkedPage) return;

    setReaderError("");
    onChangePage(bookmarkedPage);
  }

  async function selectWord(word, event) {
    event.stopPropagation();

    if (Date.now() - panRef.current.lastDragEndedAt < 150) return;

    const nextRequestId = translationRequestRef.current + 1;
    translationRequestRef.current = nextRequestId;
    const availableWidth = window.innerWidth - WORD_POPUP_MARGIN * 2;
    const popupWidth = Math.min(WORD_POPUP_WIDTH, availableWidth);
    const popupLeft = Math.min(
      Math.max(event.clientX + WORD_POPUP_MARGIN, WORD_POPUP_MARGIN),
      window.innerWidth - popupWidth - WORD_POPUP_MARGIN
    );
    const popupTop =
      event.clientY + WORD_POPUP_ESTIMATED_HEIGHT + WORD_POPUP_MARGIN >
      window.innerHeight
        ? Math.max(
            WORD_POPUP_MARGIN,
            event.clientY -
              WORD_POPUP_ESTIMATED_HEIGHT -
              WORD_POPUP_MARGIN
          )
        : event.clientY + WORD_POPUP_MARGIN;

    setSelectedWord({
      ...word,
      popupLeft,
      popupTop,
      popupWidth,
    });
    setPolish("");
    setIsTranslatingWord(true);
    setReaderError("");

    try {
      const data = await translateWord(word.text);

      if (translationRequestRef.current === nextRequestId) {
        setPolish(data.polish ?? "");
      }
    } catch (translateError) {
      console.error(translateError);

      if (translationRequestRef.current === nextRequestId) {
        setReaderError("Nie udało się automatycznie przetłumaczyć słowa.");
      }
    } finally {
      if (translationRequestRef.current === nextRequestId) {
        setIsTranslatingWord(false);
      }
    }
  }

  function startPagePan(event) {
    if (
      event.target.closest(
        "form, input, textarea, select, button, [data-word-hit]"
      )
    ) {
      return;
    }

    const viewport = pageViewportRef.current;

    if (!viewport) return;

    panRef.current = {
      isDragging: true,
      lastDragEndedAt: panRef.current.lastDragEndedAt,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop,
      startX: event.clientX,
      startY: event.clientY,
      wasDragged: false,
    };

    viewport.setPointerCapture?.(event.pointerId);
  }

  function movePagePan(event) {
    const pan = panRef.current;
    const viewport = pageViewportRef.current;

    if (!pan.isDragging || !viewport) return;

    const distanceX = event.clientX - pan.startX;
    const distanceY = event.clientY - pan.startY;

    if (Math.abs(distanceX) > 4 || Math.abs(distanceY) > 4) {
      pan.wasDragged = true;
      setIsPanningPage(true);
    }

    if (!pan.wasDragged) return;

    event.preventDefault();
    viewport.scrollLeft = pan.startScrollLeft - distanceX;
    viewport.scrollTop = pan.startScrollTop - distanceY;
  }

  function stopPagePan(event) {
    const pan = panRef.current;
    const viewport = pageViewportRef.current;

    if (!pan.isDragging) return;

    pan.isDragging = false;

    if (pan.wasDragged) {
      pan.lastDragEndedAt = Date.now();
    }

    setIsPanningPage(false);
    viewport?.releasePointerCapture?.(event.pointerId);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/80 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <button
            type="button"
            onClick={onBackToBooks}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Wróć do książek
          </button>

          <h1 className="break-words text-3xl font-bold text-white">
            {book.title}
          </h1>

          <p className="mt-2 text-slate-400">
            Strona {currentPage} z {pageCount}
            {bookmarkedPage && ` • zakładka: ${bookmarkedPage}`}
          </p>

          <p className="mt-2 text-sm text-slate-500">
            {isLoadingWords
              ? "Odczytywanie słów na stronie..."
              : "Kliknij słowo na stronie, aby dodać je do fiszek."}
          </p>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <p className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-200">
            Baza fiszek: {book.title}
          </p>

          <form
            onSubmit={goToPage}
            className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end"
          >
            <label
              htmlFor="book-page-jump"
              className="text-sm font-semibold text-slate-300"
            >
              Przenieś na stronę
            </label>

            <input
              id="book-page-jump"
              type="number"
              min="1"
              max={pageCount}
              value={pageJumpValue}
              onChange={(event) =>
                setPageJumpInput({
                  page: currentPage,
                  value: event.target.value,
                })
              }
              className="h-11 w-24 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-center font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-violet-500"
            />

            <button
              type="submit"
              className="h-11 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Przenieś
            </button>
          </form>
        </div>
      </section>

      {readerError && (
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-red-300">
          {readerError}
        </section>
      )}

      <section className="flex flex-wrap items-center justify-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-2">
          <button
            type="button"
            onClick={() => changePageZoom(pageZoom - PAGE_ZOOM_STEP)}
            disabled={pageZoom <= MIN_PAGE_ZOOM}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Pomniejsz stronę"
            title="Pomniejsz stronę"
          >
            <ZoomOut className="h-5 w-5" />
          </button>

          <span className="min-w-16 text-center text-sm font-semibold text-slate-300">
            {Math.round(pageZoom * 100)}%
          </span>

          <button
            type="button"
            onClick={() => changePageZoom(pageZoom + PAGE_ZOOM_STEP)}
            disabled={pageZoom >= MAX_PAGE_ZOOM}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Powiększ stronę"
            title="Powiększ stronę"
          >
            <ZoomIn className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => changePageZoom(1)}
            disabled={pageZoom === 1}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Resetuj powiększenie"
            title="Resetuj powiększenie"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
      </section>

      <section
        ref={pageViewportRef}
        onPointerDown={startPagePan}
        onPointerMove={movePagePan}
        onPointerUp={stopPagePan}
        onPointerCancel={stopPagePan}
        className={`reader-scroll max-h-[82vh] touch-none overflow-auto rounded-2xl border border-white/10 bg-slate-900/80 p-2 sm:rounded-3xl sm:p-4 ${
          isPanningPage ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <div
          ref={pageFrameRef}
          className="relative inline-block align-top"
          style={{
            marginInline:
              pageRenderedWidth > 0 && pageRenderedWidth <= pageViewportWidth
                ? "auto"
                : "0",
            width: pageRenderedWidth > 0 ? `${pageRenderedWidth}px` : undefined,
          }}
        >
          <img
            key={`${book.filename}-${currentPage}`}
            src={previewUrl}
            alt={`${book.title} - strona ${currentPage}`}
            className="block w-full rounded-2xl bg-white object-contain"
          />

          {pageSize.width > 0 &&
            pageWords.map((word, index) => {
              const selected = selectedWord?.text === word.text;

              return (
                <button
                  key={`${word.text}-${index}-${currentPage}`}
                  type="button"
                  data-word-hit="true"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => selectWord(word, event)}
                  title={`Dodaj "${word.text}"`}
                  className={`absolute rounded-sm transition hover:bg-violet-500/25 hover:ring-2 hover:ring-violet-500/70 ${
                    selected ? "bg-violet-500/25 ring-2 ring-violet-500" : ""
                  }`}
                  style={{
                    left: `${(word.x / pageSize.width) * 100}%`,
                    top: `${(word.y / pageSize.height) * 100}%`,
                    width: `${(word.width / pageSize.width) * 100}%`,
                    height: `${(word.height / pageSize.height) * 100}%`,
                  }}
                  aria-label={`Dodaj ${word.text} do fiszek`}
                />
              );
            })}

        </div>
      </section>

      {selectedWord &&
        typeof document !== "undefined" &&
        createPortal(
          <form
            onSubmit={saveSelectedWord}
            className="fixed z-[9999] rounded-2xl border border-violet-500/40 bg-slate-950/95 p-4 text-left shadow-2xl shadow-black/40 backdrop-blur"
            style={{
              left: `${selectedWord.popupLeft}px`,
              top: `${selectedWord.popupTop}px`,
              width: `${selectedWord.popupWidth}px`,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Angielskie słowo
                </p>
                <p className="mt-1 break-words text-lg font-bold text-white">
                  {selectedWord.text}
                </p>
              </div>

              <button
                type="button"
                onClick={cancelSelectedWord}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-slate-300 transition hover:bg-white/20 hover:text-white"
                aria-label="Anuluj"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-sm font-semibold text-slate-300">
                Tłumaczenie
              </span>
              <input
                type="text"
                value={polish}
                onChange={(event) => setPolish(event.target.value)}
                placeholder={
                  isTranslatingWord ? "Tłumaczę..." : "Wpisz po polsku..."
                }
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-violet-500"
                autoFocus
              />
            </label>

            <p className="mt-3 text-xs text-slate-500">
              Zapis do bazy: {book.title}
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelSelectedWord}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Anuluj
              </button>

              <button
                type="submit"
                disabled={isSavingWord || isTranslatingWord}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {isSavingWord ? "Dodawanie..." : "Dodaj"}
              </button>
            </div>
          </form>,
          document.body
        )}

      <section className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => onChangePage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-5 w-5" />
          Powrót
        </button>

        <button
          type="button"
          onClick={onAddBookmark}
          className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20"
        >
          <Bookmark
            className={`h-5 w-5 ${
              isCurrentPageBookmarked
                ? "fill-red-500 text-red-500"
                : "text-white"
            }`}
          />
          Dodaj zakładkę
        </button>

        <button
          type="button"
          onClick={goToBookmark}
          disabled={!bookmarkedPage || bookmarkedPage === currentPage}
          className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Bookmark className="h-5 w-5" />
          Przenieś do zakładki
        </button>

        <button
          type="button"
          onClick={() => onChangePage(currentPage + 1)}
          disabled={currentPage >= pageCount}
          className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Dalej
          <ChevronRight className="h-5 w-5" />
        </button>
      </section>
    </div>
  );
}

function loadBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}
