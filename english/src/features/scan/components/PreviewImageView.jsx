import { AlertTriangle, RotateCcw, RotateCw, X } from "lucide-react";

export default function PreviewImageView({
  imageFile,
  isProcessing,
  previewUrl,
  rotationDegrees,
  scanError,
  onChangeImage,
  onProcessImage,
  onRemoveImage,
  onRetry,
  onRotateLeft,
  onRotateRight,
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Podgląd zdjęcia</h2>

          <p className="mt-2 text-slate-400">{imageFile?.name}</p>
        </div>

        <button
          type="button"
          onClick={onRemoveImage}
          className="rounded-2xl bg-white/10 p-3 text-slate-300 transition hover:bg-white/20 hover:text-white"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/30">
        <img
          src={previewUrl}
          alt="Podgląd wybranego zdjęcia"
          className="max-h-[700px] max-w-full object-contain transition-transform duration-200"
          style={{ transform: `rotate(${rotationDegrees}deg)` }}
        />
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
            disabled={isProcessing}
            className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isProcessing ? "Ponawianie..." : "Ponów skan"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-4">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onRotateLeft}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="h-5 w-5" />
            Obróć w lewo
          </button>

          <button
            type="button"
            onClick={onRotateRight}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCw className="h-5 w-5" />
            Obróć w prawo
          </button>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onChangeImage}
            className="rounded-2xl bg-white/10 px-6 py-3 font-semibold text-white transition hover:bg-white/20"
          >
            Zmień zdjęcie
          </button>

          <button
            type="button"
            onClick={onProcessImage}
            disabled={isProcessing}
            className="rounded-2xl bg-violet-600 px-6 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isProcessing ? "Przetwarzanie..." : "Przetwórz zdjęcie"}
          </button>
        </div>
      </div>
    </div>
  );
}
