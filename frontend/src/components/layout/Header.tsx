import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, User as UserIcon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Header() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/") return "Dashboard";
    if (path.startsWith("/projects/")) return "Project Board";
    if (path.startsWith("/projects")) return "Projects";
    if (path.startsWith("/tasks")) return "Tasks & Search";
    if (path.startsWith("/members")) return "Team Members";
    if (path.startsWith("/audit-logs")) return "Audit Logs";
    if (path.startsWith("/notifications")) return "Notifications";
    return "AppZeto";
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-6">
      {/* Title / Breadcrumb */}
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold tracking-tight text-foreground">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationBell />

        <div className="h-4 w-px bg-border mx-1" />

        {/* User profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
              <Avatar className="h-8 w-8 cursor-pointer border border-border">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : <UserIcon className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-semibold leading-none">{user?.name}</p>
                <p className="text-[11px] leading-none text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
