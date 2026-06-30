import { Camera, ImagePlus } from "lucide-react";

export default function EmptyScanState({ onSelectFromLibrary, onTakePhoto }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#78b7ee]/15">
        <Camera className="h-10 w-10 text-[#78b7ee]" />
      </div>

      <h2 className="text-3xl font-bold text-white">
        Zrób zdjęcie lub wybierz plik
      </h2>

      <p className="mt-4 max-w-2xl text-xl text-[#9aa8bc]">
        Przeciągnij zdjęcie tutaj albo wybierz je z dysku
      </p>

      <div className="mt-8 grid w-full max-w-md gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onTakePhoto}
          className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[#78b7ee] px-6 py-4 text-lg font-semibold text-white transition hover:bg-[#8cc5f4]"
        >
          <Camera className="h-5 w-5" />
          Aparat
        </button>

        <button
          type="button"
          onClick={onSelectFromLibrary}
          className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[#78b7ee]/12 px-6 py-4 text-lg font-semibold text-white transition hover:bg-[#78b7ee]/20"
        >
          <ImagePlus className="h-5 w-5" />
          Biblioteka
        </button>
      </div>
    </div>
  );
}
