import { AlertTriangle, Minus, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

export default function ProcessedImageView({
  extractedWords,
  imageRef,
  isCropped,
  isExtractingWords,
  isSavingExtractedWords,
  newBaseName,
  points,
  processedUrl,
  scanError,
  selectedBaseId,
  wordBases,
  onClearPoints,
  onCropImage,
  onExtractWords,
  onImageClick,
  onMovePoint,
  onNewBaseNameChange,
  onRemoveImage,
  onRetry,
  onSaveExtractedWords,
  onSelectedBaseChange,
}) {
  const [draggedPointIndex, setDraggedPointIndex] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);

  const polygonPoints = useMemo(
    () => points.map((point) => `${point.x},${point.y}`).join(" "),
    [points]
  );

  const canDrawSelection = imageSize.width > 0 && imageSize.height > 0;

  function changeZoom(direction) {
    setZoom((currentZoom) => {
      const nextZoom = currentZoom + direction * ZOOM_STEP;

      return Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM);
    });
  }

  function handleImageLoad(event) {
    setImageSize({
      width: event.currentTarget.naturalWidth,
      height: event.currentTarget.naturalHeight,
    });
  }

  function handlePointerMove(event) {
    if (draggedPointIndex === null) return;

    event.preventDefault();
    onMovePoint(draggedPointIndex, event);
  }

  function stopDragging() {
    setDraggedPointIndex(null);
  }

  const isReviewingExtractedWords = extractedWords.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">
            {isReviewingExtractedWords ? "Wyodrębnione słowa" : "Wynik skanowania"}
          </h2>

          <p className="mt-2 text-[#9aa8bc]">
            {isReviewingExtractedWords
              ? "Sprawdź listę i wybierz bazę, do której mają trafić słowa."
              : `Zaznacz 4 punkty przycięcia: ${points.length}/4`}
          </p>
        </div>

        <button
          type="button"
          onClick={onRemoveImage}
          className="rounded-2xl bg-[#78b7ee]/12 p-3 text-[#c5d3e4] transition hover:bg-[#78b7ee]/20 hover:text-white"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {scanError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-red-200">
          <div className="flex min-w-0 items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{scanError}</p>
          </div>

          <button
            type="button"
            onClick={onRetry}
            disabled={isExtractingWords}
            className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExtractingWords ? "Ponawianie..." : "Ponów"}
          </button>
        </div>
      )}

      {!isReviewingExtractedWords && (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => changeZoom(-1)}
            disabled={zoom <= MIN_ZOOM}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#78b7ee]/12 px-5 py-3 font-semibold text-white transition hover:bg-[#78b7ee]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Minus className="h-5 w-5" />
            Zoom out
          </button>

          <span className="min-w-16 text-center text-sm font-semibold text-[#c5d3e4]">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={() => changeZoom(1)}
            disabled={zoom >= MAX_ZOOM}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#78b7ee]/12 px-5 py-3 font-semibold text-white transition hover:bg-[#78b7ee]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
            Zoom in
          </button>
        </div>
      </div>
      )}

      {!isReviewingExtractedWords && (
      <div className="max-h-[720px] overflow-auto rounded-3xl border border-[#40506a] bg-black/30">
        <div
          className="relative"
          style={{
            width: `${zoom * 100}%`,
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onPointerLeave={stopDragging}
        >
          <img
            ref={imageRef}
            src={processedUrl}
            alt="Przetworzony skan"
            onClick={onImageClick}
            onLoad={handleImageLoad}
            draggable={false}
            className="block w-full cursor-crosshair select-none object-contain"
          />

          {canDrawSelection && (
            <svg
              viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <defs>
                <mask id="scan-selection-mask">
                  <rect
                    width={imageSize.width}
                    height={imageSize.height}
                    fill="white"
                  />
                  {points.length === 4 && (
                    <polygon points={polygonPoints} fill="black" />
                  )}
                </mask>
              </defs>

              {points.length === 4 && (
                <rect
                  width={imageSize.width}
                  height={imageSize.height}
                  fill="black"
                  mask="url(#scan-selection-mask)"
                  opacity="0.55"
                />
              )}

              {points.length > 1 && points.length < 4 && (
                <polyline
                  points={polygonPoints}
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="5"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {points.length === 4 && (
                <polygon
                  points={polygonPoints}
                  fill="rgba(124, 58, 237, 0.16)"
                  stroke="#8b5cf6"
                  strokeWidth="5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          )}

          {canDrawSelection &&
            points.map((point, index) => (
              <button
                key={index}
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDraggedPointIndex(index);
                }}
                onPointerUp={stopDragging}
                onClick={(event) => event.stopPropagation()}
                className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full bg-[#78b7ee] text-sm font-bold text-white shadow-lg shadow-[#050b14]/40 ring-2 ring-white/80 transition hover:bg-[#8cc5f4]"
                style={{
                  left: `${(point.x / imageSize.width) * 100}%`,
                  top: `${(point.y / imageSize.height) * 100}%`,
                }}
              >
                {index + 1}
              </button>
            ))}
        </div>
      </div>
      )}

      {!isReviewingExtractedWords && (
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={onClearPoints}
          disabled={points.length === 0}
          className="rounded-2xl bg-[#78b7ee]/12 px-6 py-3 font-semibold text-white transition hover:bg-[#78b7ee]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Wyczyść punkty
        </button>

        <button
          type="button"
          onClick={onCropImage}
          disabled={points.length !== 4}
          className="rounded-2xl bg-[#78b7ee] px-6 py-3 font-semibold text-white transition hover:bg-[#8cc5f4] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Przytnij zaznaczenie
        </button>

        {isCropped && (
          <button
            type="button"
            onClick={onExtractWords}
            disabled={isExtractingWords}
            className="rounded-2xl bg-[#78b7ee] px-6 py-3 font-semibold text-white transition hover:bg-[#8cc5f4]"
          >
            {isExtractingWords ? "Wyodrębnianie..." : "Wyodrębnij słowa"}
          </button>
        )}
      </div>
      )}

      {extractedWords.length > 0 && (
        <section className="space-y-5 rounded-3xl border border-[#40506a] bg-[#1c2636]/90 p-6">
          <div className="grid gap-3 md:grid-cols-2">
            {extractedWords.map((word, index) => (
              <div
                key={`${word.english}-${word.polish}-${index}`}
                className="rounded-2xl border border-[#40506a] bg-[#111827]/70 p-4"
              >
                <p className="text-lg font-bold text-white">{word.english}</p>
                <p className="mt-1 text-[#9aa8bc]">{word.polish}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[#c5d3e4]">
                Dostępna baza
              </span>

              <select
                value={selectedBaseId}
                onChange={(event) => {
                  onSelectedBaseChange(event.target.value);
                  onNewBaseNameChange("");
                }}
                className="w-full rounded-2xl border border-[#40506a] bg-[#111827] px-4 py-3 text-white outline-none"
              >
                <option value="">Wybierz bazę</option>
                {wordBases.map((base) => (
                  <option key={base.id} value={base.id}>
                    {base.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-[#c5d3e4]">
                Albo utwórz nową
              </span>

              <input
                type="text"
                value={newBaseName}
                onChange={(event) => {
                  onNewBaseNameChange(event.target.value);
                  onSelectedBaseChange("");
                }}
                placeholder="np. części ciała, dom"
                className="w-full rounded-2xl border border-[#40506a] bg-[#111827] px-4 py-3 text-white outline-none placeholder:text-[#74849a]"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSaveExtractedWords}
              disabled={
                isSavingExtractedWords || (!selectedBaseId && !newBaseName.trim())
              }
              className="rounded-2xl bg-[#78b7ee] px-6 py-3 font-semibold text-white transition hover:bg-[#8cc5f4] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingExtractedWords ? "Zapisywanie..." : "Zapisz do bazy"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
