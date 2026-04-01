import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto p-0 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
