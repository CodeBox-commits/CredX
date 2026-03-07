import { TopNavbar } from "./TopNavbar";
import { Outlet } from "react-router-dom";

export const AppLayout = () => {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <TopNavbar />
      <main className="mx-auto w-full max-w-[1400px] flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <Outlet />
      </main>
    </div>
  );
};
