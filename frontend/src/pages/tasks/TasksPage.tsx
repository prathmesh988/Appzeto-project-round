import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Filter,
  CheckSquare,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useOrgStore } from "@/stores/orgStore";
import { Task, Membership } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { activeOrg } = useOrgStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Membership[]>([]);

  // Filter states
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState<string>(searchParams.get("status") || "all");
  const [priority, setPriority] = useState<string>(searchParams.get("priority") || "all");
  const [assignee, setAssignee] = useState<string>(searchParams.get("assignee") || "all");
  const [dueBefore, setDueBefore] = useState<string>(searchParams.get("dueBefore") || "");

  // Modal detail
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // AbortController for debounced request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch members for assignee filter
  useEffect(() => {
    if (!activeOrg) return;
    const fetchMembers = async () => {
      try {
        const res = await api.get(`/organizations/${activeOrg._id}/members`);
        if (res.data.success) {
          setMembers(res.data.data);
        }
      } catch {}
    };
    fetchMembers();
  }, [activeOrg]);

  const fetchTasks = useCallback(
    async (pageToFetch: number = 1, currentSearchQuery: string = query) => {
      if (!activeOrg) return;

      // Cancel previous in-flight search request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        setLoading(true);

        const params: Record<string, any> = {
          organizationId: activeOrg._id,
          page: pageToFetch,
          limit: pagination.limit,
        };

        if (currentSearchQuery.trim()) params.q = currentSearchQuery.trim();
        if (status !== "all") params.status = status;
        if (priority !== "all") params.priority = priority;
        if (assignee === "me") params.assignee = "me";
        else if (assignee !== "all") params.assignee = assignee;
        if (dueBefore) params.dueBefore = dueBefore;

        const res = await api.get("/tasks", {
          params,
          signal: abortControllerRef.current.signal,
        });

        if (res.data.success) {
          setTasks(res.data.data);
          setPagination(res.data.pagination || { page: pageToFetch, limit: 20, total: 0, hasMore: false });
        }
      } catch (err: any) {
        if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") {
          console.error("Failed to fetch tasks", err);
        }
      } finally {
        setLoading(false);
      }
    },
    [activeOrg, status, priority, assignee, dueBefore, pagination.limit]
  );

  // Debounced search trigger (300ms) with AbortController
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTasks(1, query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, fetchTasks]);

  const handlePageChange = (newPage: number) => {
    fetchTasks(newPage);
  };

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setPriority("all");
    setAssignee("all");
    setDueBefore("");
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "URGENT":
        return <Badge variant="destructive" className="text-[10px] font-bold">Urgent</Badge>;
      case "HIGH":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px]">High</Badge>;
      case "MEDIUM":
        return <Badge variant="secondary" className="text-[10px]">Medium</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">Low</Badge>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "DONE":
        return <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Done</span>;
      case "IN_PROGRESS":
        return <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">In Progress</span>;
      case "REVIEW":
        return <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">Review</span>;
      default:
        return <span className="text-xs font-semibold text-muted-foreground">To Do</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            <span>Tasks & Search</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Filter, search and inspect all tasks across {activeOrg?.name}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Text Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks by title or description (debounced 300ms)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          {/* Quick Clear */}
          {(query || status !== "all" || priority !== "all" || assignee !== "all" || dueBefore) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              <span>Clear filters</span>
            </Button>
          )}
        </div>

        {/* Filter dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {/* Status */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="TODO">To Do</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="REVIEW">Review</SelectItem>
                <SelectItem value="DONE">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Priority
            </label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Assignee
            </label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                <SelectItem value="me">Assigned to Me</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId._id} value={m.userId._id}>
                    {m.userId.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Before */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Due Before
            </label>
            <Input
              type="date"
              value={dueBefore}
              onChange={(e) => setDueBefore(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Tasks Data Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[38%] text-xs font-semibold">Title</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">Priority</TableHead>
              <TableHead className="text-xs font-semibold">Assignee</TableHead>
              <TableHead className="text-xs font-semibold">Due Date</TableHead>
              <TableHead className="text-xs font-semibold">Labels</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                  Searching tasks...
                </TableCell>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                  No tasks matched your search or filters.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => {
                const assigneeName =
                  task.assigneeId && typeof task.assigneeId === "object"
                    ? task.assigneeId.name
                    : undefined;

                return (
                  <TableRow
                    key={task._id}
                    onClick={() => {
                      setSelectedTaskId(task._id);
                      setDetailOpen(true);
                    }}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <TableCell className="font-medium text-xs text-foreground">
                      <div className="space-y-0.5">
                        <div className="font-semibold">{task.title}</div>
                        {task.description && (
                          <div className="text-[11px] text-muted-foreground line-clamp-1">
                            {task.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {assigneeName ? (
                        <span className="text-foreground font-medium">{assigneeName}</span>
                      ) : (
                        <span className="italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {task.dueDate ? (
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Calendar className="h-3 w-3" />
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {task.labels?.map((l) => (
                          <Badge key={l} variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                            {l}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination controls */}
        <div className="flex items-center justify-between border-t border-border p-3 text-xs text-muted-foreground">
          <div>
            Showing {tasks.length} of {pagination.total} tasks (Page {pagination.page})
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasMore || loading}
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <TaskDetailSheet
        taskId={selectedTaskId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onTaskUpdated={() => fetchTasks(pagination.page)}
        onTaskDeleted={() => {
          setSelectedTaskId(null);
          fetchTasks(pagination.page);
        }}
      />
    </div>
  );
}
