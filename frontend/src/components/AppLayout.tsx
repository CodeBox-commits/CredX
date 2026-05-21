import { TopNavbar } from "./TopNavbar";
import { Outlet } from "react-router-dom";

export const AppLayout = () => {
  return (
    <div className="flex min-h-screen flex-col overflow-hidden">
      <TopNavbar />
      <main className="mx-auto w-full max-w-[1480px] flex-1 overflow-y-auto px-3 py-5 md:px-5 md:py-6">
        <Outlet />
      </main>
    </div>
  );
};
