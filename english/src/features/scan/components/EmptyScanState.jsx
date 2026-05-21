import { Camera, Upload } from "lucide-react";

export default function EmptyScanState({ onSelectImage }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-600/15">
        <Camera className="h-10 w-10 text-violet-500" />
      </div>

      <h2 className="text-3xl font-bold text-white">
        Zrób zdjęcie lub wybierz plik
      </h2>

      <p className="mt-4 max-w-2xl text-xl text-slate-400">
        Przeciągnij zdjęcie tutaj albo wybierz je z dysku
      </p>

      <button
        type="button"
        onClick={onSelectImage}
        className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-violet-600 px-6 py-4 text-lg font-semibold text-white transition hover:bg-violet-500"
      >
        <Upload className="h-5 w-5" />
        Wybierz obrazek
      </button>
    </div>
  );
}
