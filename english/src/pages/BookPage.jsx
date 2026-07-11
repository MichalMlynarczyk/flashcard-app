import {
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Eye,
  Maximize2,
  Minimize2,
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
  AuthRequiredError,
  createWord,
  translateWord,
} from "../features/words/services/wordsApi";

const BOOKMARKS_STORAGE_KEY = "brainlift-bookmarks";
const MIN_PAGE_ZOOM = 0.75;
const MAX_PAGE_ZOOM = 2.5;
const PAGE_ZOOM_STEP = 0.25;
const PAGE_ZOOM_SLIDER_STEP = 0.01;
const WORD_POPUP_WIDTH = 352;
const WORD_POPUP_ESTIMATED_HEIGHT = 300;
const WORD_POPUP_MARGIN = 12;
const PAGE_SWIPE_THRESHOLD = 72;
const PAGE_SWIPE_VERTICAL_RATIO = 1.35;
const COARSE_POINTER_QUERY = "(pointer: coarse)";
const FALLBACK_CONTEXT_WORDS = 18;

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

        <p className="mt-4 text-xl text-[#9aa8bc]">
          Wybierz książkę, a potem podejrzyj pojedynczą stronę PDF.
        </p>
      </section>

      {isLoading && (
        <section className="rounded-3xl border border-[#40506a] bg-[#1c2636]/90 p-6 text-[#9aa8bc]">
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
              className="rounded-3xl border border-[#40506a] bg-[#1c2636]/90 p-6 transition hover:border-[#78b7ee]/65 hover:bg-[#78b7ee]/12"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#78b7ee]/15">
                  <BookOpen className="h-6 w-6 text-[#9ed0ff]" />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-xl font-bold text-white">
                    {book.title}
                  </h2>

                  <p className="mt-2 break-words text-sm text-[#74849a]">
                    {book.filename}
                  </p>

                  <p className="mt-2 text-sm font-medium text-[#9aa8bc]">
                    {book.pageCount || "?"} stron
                  </p>

                  {bookmarks[book.filename] && (
                    <p className="mt-2 text-sm font-medium text-[#9ed0ff]">
                      Zakładka: strona {bookmarks[book.filename]}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openBook(book)}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#78b7ee] px-5 py-3 font-semibold text-white transition hover:bg-[#8cc5f4]"
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
  const [pageText, setPageText] = useState("");
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [pageViewportSize, setPageViewportSize] = useState({
    width: 0,
    height: 0,
  });
  const [selectedWord, setSelectedWord] = useState(null);
  const [polish, setPolish] = useState("");
  const [isTranslatingWord, setIsTranslatingWord] = useState(false);
  const [, setIsLoadingWords] = useState(false);
  const [isSavingWord, setIsSavingWord] = useState(false);
  const [readerError, setReaderError] = useState("");
  const [pageZoom, setPageZoom] = useState(1);
  const [isPanningPage, setIsPanningPage] = useState(false);
  const [isReadingFullscreen, setIsReadingFullscreen] = useState(true);
  const pageAspectRatio =
    pageSize.width > 0 && pageSize.height > 0
      ? pageSize.height / pageSize.width
      : 0;
  const pageRenderedWidth = pageViewportSize.width
    ? pageViewportSize.width * pageZoom
    : 0;
  const pageRenderedHeight =
    pageRenderedWidth > 0 && pageAspectRatio > 0
      ? pageRenderedWidth * pageAspectRatio
      : 0;
  const isCurrentPageBookmarked = bookmarkedPage === currentPage;
  const isZoomedIn = pageZoom > 1;

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
          setPageWords(data.words ?? []);
          setPageText(data.pageText ?? "");
          setPageSize({ width: data.width, height: data.height });
        }
      } catch (loadError) {
        if (!ignore) {
          console.error(loadError);
          setReaderError("Nie udało się odczytać słów z tej strony.");
          setPageWords([]);
          setPageText("");
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

    function updateViewportSize() {
      setPageViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
    }

    updateViewportSize();

    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isZoomedIn) return undefined;

    const animationFrame = requestAnimationFrame(centerPageHorizontally);
    const timeout = window.setTimeout(centerPageHorizontally, 80);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
    };
  }, [currentPage, isZoomedIn, pageRenderedWidth]);

  useEffect(() => {
    const viewport = pageViewportRef.current;

    if (!viewport) return undefined;

    const animationFrame = requestAnimationFrame(() => {
      viewport.scrollTop = 0;

      if (isZoomedIn) {
        centerPageHorizontally();
      }
    });

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [currentPage, isZoomedIn]);

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
      setReaderError(
        saveError instanceof AuthRequiredError
          ? saveError.message
          : "Nie udało się dodać słowa do fiszek."
      );
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

  function centerPageHorizontally() {
    const viewport = pageViewportRef.current;

    if (!viewport) return;

    const maxScrollLeft = Math.max(
      viewport.scrollWidth - viewport.clientWidth,
      0
    );
    viewport.scrollLeft = maxScrollLeft / 2;
  }

  function cancelSelectedWord() {
    translationRequestRef.current += 1;
    setSelectedWord(null);
    setPolish("");
    setIsTranslatingWord(false);
    setReaderError("");
  }

  function goToBookmark() {
    if (!bookmarkedPage) return;

    setReaderError("");
    onChangePage(bookmarkedPage);
  }

  function isCoarsePointer() {
    return window.matchMedia?.(COARSE_POINTER_QUERY).matches ?? false;
  }

  async function selectWord(word, wordIndex, event) {
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

    const sentence = getSelectedWordSentence({
      pageText,
      pageWords,
      word,
      wordIndex,
    });

    setSelectedWord({
      ...word,
      sentence,
      popupLeft,
      popupTop,
      popupWidth,
    });
    setPolish("");
    setIsTranslatingWord(true);
    setReaderError("");

    try {
      const data = await translateWord({
        english: word.text,
        sentence,
      });

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
    if (isReadingFullscreen) return;

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

    const distanceX = event.clientX - pan.startX;
    const distanceY = event.clientY - pan.startY;

    pan.isDragging = false;

    if (pan.wasDragged) {
      pan.lastDragEndedAt = Date.now();
    }

    if (
      isCoarsePointer() &&
      pageZoom === 1 &&
      pan.wasDragged &&
      Math.abs(distanceX) > PAGE_SWIPE_THRESHOLD &&
      Math.abs(distanceX) > Math.abs(distanceY) * PAGE_SWIPE_VERTICAL_RATIO
    ) {
      setReaderError("");
      onChangePage(distanceX < 0 ? currentPage + 1 : currentPage - 1);
    }

    setIsPanningPage(false);
    viewport?.releasePointerCapture?.(event.pointerId);
  }

  return (
    <div
      className={
        isReadingFullscreen
          ? "fixed inset-0 z-[60] w-screen bg-[#111827]"
          : "relative left-1/2 w-screen max-w-none -translate-x-1/2 space-y-4 px-0 sm:px-4 xl:left-0 xl:w-full xl:translate-x-0"
      }
    >
      {isReadingFullscreen && (
        <button
          type="button"
          onClick={onBackToBooks}
          className="fixed right-4 top-4 z-[70] flex h-12 w-12 items-center justify-center rounded-full border border-[#587091] bg-[#111827]/55 text-white shadow-xl shadow-black/30 backdrop-blur transition hover:bg-[#1c2636]/90"
          aria-label="Wróć do listy książek"
          title="Wróć do listy książek"
        >
          <Minimize2 className="h-5 w-5" />
        </button>
      )}

      {!isReadingFullscreen && readerError && (
        <section className="mx-4 rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-red-300 sm:mx-0">
          {readerError}
        </section>
      )}

      {!isReadingFullscreen && (
      <section className="flex flex-wrap items-center justify-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-[#40506a] bg-[#1c2636]/90 p-2">
          <button
            type="button"
            onClick={() => changePageZoom(pageZoom - PAGE_ZOOM_STEP)}
            disabled={pageZoom <= MIN_PAGE_ZOOM}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#78b7ee]/12 text-white transition hover:bg-[#78b7ee]/20 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Pomniejsz stronę"
            title="Pomniejsz stronę"
          >
            <ZoomOut className="h-5 w-5" />
          </button>

          <span className="min-w-16 text-center text-sm font-semibold text-[#c5d3e4]">
            {Math.round(pageZoom * 100)}%
          </span>

          <button
            type="button"
            onClick={() => changePageZoom(pageZoom + PAGE_ZOOM_STEP)}
            disabled={pageZoom >= MAX_PAGE_ZOOM}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#78b7ee]/12 text-white transition hover:bg-[#78b7ee]/20 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Powiększ stronę"
            title="Powiększ stronę"
          >
            <ZoomIn className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => changePageZoom(1)}
            disabled={pageZoom === 1}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#78b7ee]/12 text-white transition hover:bg-[#78b7ee]/20 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Resetuj powiększenie"
            title="Resetuj powiększenie"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsReadingFullscreen(true)}
          className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[#9ed0ff]/45 bg-[#78b7ee] text-white shadow-lg shadow-[#050b14]/40 transition hover:bg-[#8cc5f4]"
          aria-label="Pełny ekran czytania"
          title="Pełny ekran czytania"
        >
          <Maximize2 className="h-6 w-6" />
        </button>
      </section>
      )}

      <section
        ref={pageViewportRef}
        onPointerDown={startPagePan}
        onPointerMove={movePagePan}
        onPointerUp={stopPagePan}
        onPointerCancel={stopPagePan}
        className={`reader-scroll ${
          isReadingFullscreen
            ? "reader-scroll-visible h-dvh min-h-0 touch-auto overflow-auto border-0 bg-slate-100 pb-40"
            : "reader-scroll-visible h-[calc(100dvh-11.5rem)] min-h-[30rem] touch-none overflow-auto border-y border-[#40506a] bg-[#1c2636]/90 sm:h-[calc(100dvh-13rem)] sm:rounded-3xl sm:border xl:h-[calc(100dvh-12rem)]"
        } ${
          isPanningPage ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <div
          ref={pageFrameRef}
          className="relative block min-h-full align-top"
          style={{
            marginInline:
              pageRenderedWidth > 0 &&
              pageRenderedWidth <= pageViewportSize.width
                ? "auto"
                : "0",
            width: pageRenderedWidth > 0 ? `${pageRenderedWidth}px` : undefined,
            height:
              pageRenderedHeight > 0 ? `${pageRenderedHeight}px` : undefined,
          }}
        >
          <img
            key={`${book.filename}-${currentPage}`}
            src={previewUrl}
            alt={`${book.title} - strona ${currentPage}`}
            draggable={false}
            className="pointer-events-none block h-full w-full select-none bg-white"
          />

          {pageSize.width > 0 &&
            pageWords.map((word, index) => {
              const selected = selectedWord?.text === word.text;

              return (
                <button
                  key={`${word.text}-${index}-${currentPage}`}
                  type="button"
                  data-word-hit="true"
                  onClick={(event) => selectWord(word, index, event)}
                  title={`Dodaj "${word.text}"`}
                  className={`absolute rounded-sm transition hover:bg-[#78b7ee]/25 hover:ring-2 hover:ring-[#78b7ee]/70 ${
                    selected ? "bg-[#78b7ee]/25 ring-2 ring-[#78b7ee]" : ""
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

      {isReadingFullscreen && (
        <section className="fixed inset-x-3 bottom-3 z-[70] mx-auto grid max-w-2xl grid-cols-3 gap-2 rounded-2xl border border-[#587091] bg-[#111827]/55 p-2 text-white shadow-2xl shadow-black/30 backdrop-blur">
          <button
            type="button"
            onClick={() => onChangePage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="inline-flex min-w-0 items-center justify-center gap-1 rounded-xl bg-[#78b7ee]/12 px-2 py-2.5 text-sm font-semibold transition hover:bg-[#78b7ee]/20 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">Powrót</span>
          </button>

          <button
            type="button"
            onClick={onAddBookmark}
            className="inline-flex min-w-0 items-center justify-center gap-1 rounded-xl bg-[#78b7ee]/12 px-2 py-2.5 text-sm font-semibold transition hover:bg-[#78b7ee]/20"
          >
            <Bookmark
              className={`h-4 w-4 shrink-0 ${
                isCurrentPageBookmarked
                  ? "fill-red-500 text-red-500"
                  : "text-white"
              }`}
            />
            <span className="truncate">Zakładka</span>
          </button>

          <button
            type="button"
            onClick={() => onChangePage(currentPage + 1)}
            disabled={currentPage >= pageCount}
            className="inline-flex min-w-0 items-center justify-center gap-1 rounded-xl bg-[#78b7ee]/90 px-2 py-2.5 text-sm font-semibold transition hover:bg-[#8cc5f4] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="truncate">Dalej</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>

          <button
            type="button"
            onClick={goToBookmark}
            disabled={!bookmarkedPage || bookmarkedPage === currentPage}
            className="inline-flex min-w-0 items-center justify-center gap-1 rounded-xl bg-[#78b7ee]/12 px-2 py-2.5 text-sm font-semibold transition hover:bg-[#78b7ee]/20 disabled:cursor-not-allowed disabled:opacity-45"
            title="Przenieś na zakładkę"
          >
            <Bookmark className="h-4 w-4 shrink-0" />
            <span className="truncate">Do zakładki</span>
          </button>

          <label className="col-span-2 flex min-w-0 items-center gap-3 rounded-xl bg-[#78b7ee]/12 px-3 py-2.5 text-sm font-semibold">
            <span className="shrink-0">Zoom</span>
            <input
              type="range"
              min={MIN_PAGE_ZOOM}
              max={MAX_PAGE_ZOOM}
              step={PAGE_ZOOM_SLIDER_STEP}
              value={pageZoom}
              onChange={(event) =>
                changePageZoom(Number(event.currentTarget.value))
              }
              className="min-w-0 flex-1 accent-[#78b7ee]"
              aria-label="Zoom strony"
            />
            <span className="w-10 shrink-0 text-right text-xs text-[#c5d3e4]">
              {Math.round(pageZoom * 100)}%
            </span>
          </label>
        </section>
      )}

      {selectedWord &&
        typeof document !== "undefined" &&
        createPortal(
          <form
            onSubmit={saveSelectedWord}
            className="fixed z-[9999] rounded-2xl border border-[#78b7ee]/50 bg-[#111827]/95 p-4 text-left shadow-2xl shadow-black/40 backdrop-blur"
            style={{
              left: `${selectedWord.popupLeft}px`,
              top: `${selectedWord.popupTop}px`,
              width: `${selectedWord.popupWidth}px`,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-[#74849a]">
                  Angielskie słowo
                </p>
                <p className="mt-1 break-words text-lg font-bold text-white">
                  {selectedWord.text}
                </p>
              </div>

              <button
                type="button"
                onClick={cancelSelectedWord}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#78b7ee]/12 text-[#c5d3e4] transition hover:bg-[#78b7ee]/20 hover:text-white"
                aria-label="Anuluj"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-sm font-semibold text-[#c5d3e4]">
                Tłumaczenie
              </span>
              <input
                type="text"
                value={polish}
                onChange={(event) => setPolish(event.target.value)}
                placeholder={
                  isTranslatingWord ? "Tłumaczę..." : "Wpisz po polsku..."
                }
                className="w-full rounded-xl border border-[#40506a] bg-[#1c2636] px-3 py-2.5 text-white outline-none placeholder:text-[#74849a] focus:border-[#78b7ee]"
                autoFocus
              />
            </label>

            <p className="mt-3 text-xs text-[#74849a]">
              Zapis do bazy: {book.title}
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelSelectedWord}
                className="rounded-xl bg-[#78b7ee]/12 px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#78b7ee]/20"
              >
                Anuluj
              </button>

              <button
                type="submit"
                disabled={isSavingWord || isTranslatingWord}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#78b7ee] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#8cc5f4] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {isSavingWord ? "Dodawanie..." : "Dodaj"}
              </button>
            </div>
          </form>,
          document.body
        )}

      {!isReadingFullscreen && (
      <section className="grid grid-cols-2 gap-3 px-4 sm:flex sm:flex-wrap sm:justify-center sm:px-0">
        <button
          type="button"
          onClick={() => onChangePage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#78b7ee]/12 px-5 py-3 font-semibold text-white transition hover:bg-[#78b7ee]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-5 w-5" />
          Powrót
        </button>

        <button
          type="button"
          onClick={onAddBookmark}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#78b7ee]/12 px-5 py-3 font-semibold text-white transition hover:bg-[#78b7ee]/20"
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
          className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-[#78b7ee]/12 px-5 py-3 font-semibold text-white transition hover:bg-[#78b7ee]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Bookmark className="h-5 w-5" />
          <span className="truncate">Przenieś do zakładki</span>
        </button>

        <button
          type="button"
          onClick={() => onChangePage(currentPage + 1)}
          disabled={currentPage >= pageCount}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#78b7ee] px-5 py-3 font-semibold text-white transition hover:bg-[#8cc5f4] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Dalej
          <ChevronRight className="h-5 w-5" />
        </button>
      </section>
      )}
    </div>
  );
}

function getSelectedWordSentence({ pageText, pageWords, word, wordIndex }) {
  const sentenceFromPageText = extractSentenceFromPageText({
    pageText,
    pageWords,
    word,
    wordIndex,
  });

  if (sentenceFromPageText) {
    return sentenceFromPageText;
  }

  return buildFallbackContext(pageWords, wordIndex);
}

function extractSentenceFromPageText({ pageText, pageWords, word, wordIndex }) {
  const normalizedWord = normalizeComparableWord(word.text);

  if (!pageText || !normalizedWord) {
    return "";
  }

  const occurrenceNumber = pageWords
    .slice(0, wordIndex + 1)
    .filter((pageWord) => normalizeComparableWord(pageWord.text) === normalizedWord)
    .length;

  const wordMatches = Array.from(
    pageText.matchAll(/[A-Za-z]+(?:[-'][A-Za-z]+)?/g)
  ).filter((match) => normalizeComparableWord(match[0]) === normalizedWord);
  const selectedMatch = wordMatches[occurrenceNumber - 1] ?? wordMatches[0];

  if (!selectedMatch) {
    return "";
  }

  const sentenceStart = findSentenceStart(pageText, selectedMatch.index);
  const sentenceEnd = findSentenceEnd(pageText, selectedMatch.index);

  return pageText.slice(sentenceStart, sentenceEnd).replace(/\s+/g, " ").trim();
}

function findSentenceStart(text, selectedWordIndex) {
  for (let index = selectedWordIndex - 1; index >= 0; index -= 1) {
    if (/[.!?]/.test(text[index])) {
      return index + 1;
    }
  }

  return 0;
}

function findSentenceEnd(text, selectedWordIndex) {
  for (let index = selectedWordIndex; index < text.length; index += 1) {
    if (/[.!?]/.test(text[index])) {
      return index + 1;
    }
  }

  return text.length;
}

function buildFallbackContext(pageWords, wordIndex) {
  const startIndex = Math.max(wordIndex - FALLBACK_CONTEXT_WORDS, 0);
  const endIndex = Math.min(wordIndex + FALLBACK_CONTEXT_WORDS + 1, pageWords.length);

  return pageWords
    .slice(startIndex, endIndex)
    .map((pageWord) => pageWord.text)
    .join(" ")
    .trim();
}

function normalizeComparableWord(value) {
  return (value ?? "").toLowerCase().replace(/[^a-z'-]/g, "");
}

function loadBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}
