import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderKanban,
  Kanban,
  CheckSquare,
  ArrowRight,
  TrendingUp,
  UserCheck,
  Calendar,
  Sparkles,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useOrgStore } from "@/stores/orgStore";
import { Task, Project, AuditLog } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";

export function DashboardPage() {
  const { user } = useAuthStore();
  const { activeOrg } = useOrgStore();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const isOwnerOrAdmin =
    activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";

  const fetchDashboardData = async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);

      // 1. Fetch tasks
      const tasksRes = await api.get(`/tasks?organizationId=${activeOrg._id}&limit=100`);
      if (tasksRes.data.success) {
        setTasks(tasksRes.data.data);
      }

      // 2. Fetch projects
      const projRes = await api.get("/projects");
      if (projRes.data.success) {
        setProjects(resOrArray(projRes.data.data));
      }

      // 3. Fetch recent activity if ADMIN/OWNER
      if (isOwnerOrAdmin) {
        try {
          const actRes = await api.get(
            `/audit-logs?organizationId=${activeOrg._id}&limit=8`
          );
          if (actRes.data.success) {
            setActivity(actRes.data.data);
          }
        } catch {}
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  function resOrArray(val: any) {
    return Array.isArray(val) ? val : [];
  }

  useEffect(() => {
    fetchDashboardData();
  }, [activeOrg]);

  // Compute metrics
  const now = new Date();
  const todoCount = tasks.filter((t) => t.status === "TODO").length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const reviewCount = tasks.filter((t) => t.status === "REVIEW").length;
  const doneCount = tasks.filter((t) => t.status === "DONE").length;

  const overdueCount = tasks.filter((t) => {
    if (t.status === "DONE" || !t.dueDate) return false;
    return new Date(t.dueDate) < now;
  }).length;

  const myTasks = tasks.filter((t) => {
    if (!t.assigneeId) return false;
    const aId = typeof t.assigneeId === "object" ? t.assigneeId._id : t.assigneeId;
    return aId === user?._id;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <Badge variant="destructive" className="text-[10px]">Urgent</Badge>;
      case "HIGH":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px]">High</Badge>;
      case "MEDIUM":
        return <Badge variant="secondary" className="text-[10px]">Medium</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">Low</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DONE":
        return <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Done</span>;
      case "IN_PROGRESS":
        return <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">In Progress</span>;
      case "REVIEW":
        return <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">Review</span>;
      default:
        return <span className="text-[11px] font-semibold text-muted-foreground">To Do</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Welcome back, {user?.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            Overview of tasks, progress, and activity in{" "}
            <span className="font-semibold text-foreground">{activeOrg?.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/board">
            <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold">
              <Kanban className="h-3.5 w-3.5" />
              <span>Kanban Board</span>
            </Button>
          </Link>
          <Link to="/projects">
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Projects</span>
            </Button>
          </Link>
          <Link to="/tasks">
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
              <CheckSquare className="h-3.5 w-3.5" />
              <span>Search Tasks</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total & My Assigned */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              My Assigned Tasks
            </CardTitle>
            <UserCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myTasks.length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Out of {tasks.length} total tasks
            </p>
          </CardContent>
        </Card>

        {/* In Progress */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              In Progress
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {inProgressCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {todoCount} waiting in To Do
            </p>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Overdue Tasks
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueCount > 0 ? "text-destructive" : ""}`}>
              {overdueCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Due date passed & not done
            </p>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Completed Tasks
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {doneCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {reviewCount} currently in review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout: My Tasks & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: My Assigned Tasks */}
        <Card className="lg:col-span-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
            <div>
              <CardTitle className="text-sm font-semibold">My Assigned Tasks</CardTitle>
              <p className="text-xs text-muted-foreground">
                Tasks assigned to you requiring attention
              </p>
            </div>
            <Link
              to="/tasks?assignee=me"
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {myTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                You have no assigned tasks in this organization.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {myTasks.slice(0, 6).map((t) => (
                  <div
                    key={t._id}
                    onClick={() => {
                      setSelectedTaskId(t._id);
                      setDetailOpen(true);
                    }}
                    className="flex items-center justify-between p-3.5 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <div className="space-y-1 truncate pr-3">
                      <p className="text-xs font-semibold text-foreground truncate">{t.title}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {getStatusBadge(t.status)}
                        {t.dueDate && (
                          <span className="flex items-center gap-1 text-[10px]">
                            <Calendar className="h-3 w-3" />
                            {new Date(t.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">{getPriorityBadge(t.priority)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Recent Activity Feed */}
        <Card className="shadow-xs">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
            <p className="text-xs text-muted-foreground">
              Audit log mutations stream
            </p>
          </CardHeader>
          <CardContent className="p-3">
            {!isOwnerOrAdmin ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Audit activity stream is visible to Admins and Owners.
              </div>
            ) : activity.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No recent activity recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {activity.map((log) => (
                  <div key={log._id} className="text-xs space-y-0.5 border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {log.userId?.name || "System"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-muted-foreground font-mono text-[11px]">
                      {log.action}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TaskDetailSheet
        taskId={selectedTaskId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onTaskUpdated={fetchDashboardData}
        onTaskDeleted={() => {
          setSelectedTaskId(null);
          fetchDashboardData();
        }}
      />
    </div>
  );
}
