import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Kanban,
  FolderKanban,
  CheckSquare,
  Users,
  ScrollText,
  Bell,
  Sparkles,
} from "lucide-react";
import { OrgSwitcher } from "@/components/org/OrgSwitcher";
import { useOrgStore } from "@/stores/orgStore";

export function Sidebar() {
  const location = useLocation();
  const { activeOrg } = useOrgStore();

  const isRoleAdminOrOwner =
    activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Kanban Board", href: "/board", icon: Kanban },
    { name: "Projects", href: "/projects", icon: FolderKanban },
    { name: "Tasks & Search", href: "/tasks", icon: CheckSquare },
    { name: "Members", href: "/members", icon: Users },
    ...(isRoleAdminOrOwner
      ? [{ name: "Audit Logs", href: "/audit-logs", icon: ScrollText }]
      : []),
    { name: "Notifications", href: "/notifications", icon: Bell },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card">
      {/* Brand header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
        <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-base font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            AppZeto
          </span>
        </Link>
      </div>

      {/* Org switcher */}
      <div className="p-3 border-b border-border/50">
        <OrgSwitcher />
      </div>

      {/* Navigation links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace
        </div>
        {navigation.map((item) => {
          const isActive =
            item.href === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
