import ScanSection from "../features/scan/components/ScanSection";

export default function ScanPage() {
  return (
    <div className="space-y-10">
      <ScanPageDescription />
      <ScanSection />
    </div>
  );
}

function ScanPageDescription() {
  return (
    <section className="rounded-[28px] border border-[#40506a] bg-[#111827]/70 p-10 shadow-xl">
      <h1 className="text-5xl font-bold tracking-tight text-white">
        Skanuj tekst
      </h1>

      <p className="mt-4 max-w-4xl text-xl leading-relaxed text-[#9aa8bc]">
        Zrób zdjęcie książki lub zeszytu — AI wyciągnie słówka i doda je do
        Twojego słownika
      </p>
    </section>
  );
}
