import { Outlet } from "react-router-dom";
import LeftPanel from "../sections/LeftPanel";

export default function AppLayout() {
  return (
    <main className="min-h-screen min-h-dvh w-full bg-slate-950 text-white">
      <div className="flex min-h-screen min-h-dvh flex-col bg-slate-950 xl:flex-row">
        <LeftPanel />

        <div className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-10 xl:py-10">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </div>
      </div>
    </main>
  );
}
