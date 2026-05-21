import { Outlet } from "react-router-dom";
import LeftPanel from "../sections/LeftPanel";

export default function AppLayout() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen flex-col xl:flex-row">
        <LeftPanel />

        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10 xl:py-10">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </div>
      </div>
    </main>
  );
}
