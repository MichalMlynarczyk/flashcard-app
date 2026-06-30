import { Outlet } from "react-router-dom";
import LeftPanel from "../sections/LeftPanel";

export default function AppLayout() {
  return (
    <main className="min-h-screen min-h-dvh w-full bg-[#111827] text-white">
      <div className="flex min-h-screen min-h-dvh flex-col bg-[#111827] xl:flex-row">
        <LeftPanel />

        <div className="min-w-0 flex-1 overflow-x-hidden px-3 py-4 sm:px-5 lg:px-7 xl:py-7">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </div>
      </div>
    </main>
  );
}
