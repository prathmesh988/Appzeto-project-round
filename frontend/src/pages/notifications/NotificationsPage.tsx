import { useState, useEffect } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  UserCheck,
  AtSign,
  AlertTriangle,
  Building,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/authStore";
import { Notification } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function NotificationsPage() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get("/notifications?limit=50");
      if (res.data.success) {
        setNotifications(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const socket = getSocket();
    const handleNewNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      toast.error("Failed to mark as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error("Failed to mark all as read");
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "TASK_ASSIGNED":
        return <UserCheck className="h-4 w-4 text-blue-500" />;
      case "MENTION":
        return <AtSign className="h-4 w-4 text-purple-500" />;
      case "STATUS_CHANGED":
        return <RefreshCw className="h-4 w-4 text-amber-500" />;
      case "DEADLINE_APPROACHING":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "ADDED_TO_ORG":
        return <Building className="h-4 w-4 text-emerald-500" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const displayedNotifications = notifications.filter((n) =>
    filter === "unread" ? !n.read : true
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <span>Notifications</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Real-time activity alerts, task assignments, and mentions
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="h-8 gap-1.5 text-xs"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark all as read</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
          className="h-7 text-xs"
        >
          All ({notifications.length})
        </Button>
        <Button
          variant={filter === "unread" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("unread")}
          className="h-7 text-xs"
        >
          Unread ({unreadCount})
        </Button>
      </div>

      {/* Notifications List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60 shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            Loading notifications...
          </div>
        ) : displayedNotifications.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            {filter === "unread"
              ? "You have no unread notifications."
              : "No notifications found."}
          </div>
        ) : (
          displayedNotifications.map((n) => (
            <div
              key={n._id}
              className={`flex items-start justify-between gap-3 p-4 transition-colors ${
                !n.read ? "bg-muted/20" : "hover:bg-muted/10"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 rounded-full bg-background border border-border/80 shadow-2xs">
                  {getNotificationIcon(n.type)}
                </div>
                <div className="space-y-1">
                  <p className={`text-xs leading-snug ${!n.read ? "font-semibold text-foreground" : "text-foreground/90"}`}>
                    {n.message}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="font-mono">{n.type}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {!n.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAsRead(n._id)}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground shrink-0"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  <span>Mark read</span>
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
