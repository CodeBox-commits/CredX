import { TopNavbar } from "./TopNavbar";

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <TopNavbar />
      <main className="mx-auto w-full max-w-[1400px] flex-1 overflow-y-auto px-4 py-6 md:px-6">{children}</main>
    </div>
  );
};
