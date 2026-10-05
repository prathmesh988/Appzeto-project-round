import { useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useOrgStore } from "@/stores/orgStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { getSocket } from "@/lib/socket";

export function AppLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const { activeOrg } = useOrgStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Connect socket on app mount
      getSocket();
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col pl-64 min-w-0">
        <Header />
        <main className="flex-1 p-6 overflow-y-auto">
          {!activeOrg ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 border border-dashed rounded-xl max-w-lg mx-auto mt-12 bg-muted/20">
              <h3 className="text-base font-semibold mb-2">No Active Organization</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Please select or create an organization from the sidebar switcher to start managing your projects and tasks.
              </p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
