import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MotionConfig } from "motion/react";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  FolderKanban,
  Kanban,
  ChevronsUpDown,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/authStore";
import { useOrgStore } from "@/stores/orgStore";
import { Task, Project, TaskStatus, Membership } from "@/types";
import {
  Column,
  gentleSpring,
  ColumnData,
  ColumnStatus,
  DragState,
  CardData,
} from "@/components/ui/kanban-board";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";

const STATUS_COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "TODO", title: "To Do" },
  { id: "IN_PROGRESS", title: "In Progress" },
  { id: "REVIEW", title: "Review" },
  { id: "DONE", title: "Done" },
];

export function ProjectBoardPage() {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { activeOrg } = useOrgStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(routeProjectId || null);
  const [project, setProject] = useState<Project | null>(null);
  const [columns, setColumns] = useState<ColumnData[]>([
    { id: "TODO", title: "To Do", status: "TODO", cards: [] },
    { id: "IN_PROGRESS", title: "In Progress", status: "IN_PROGRESS", cards: [] },
    { id: "REVIEW", title: "Review", status: "REVIEW", cards: [] },
    { id: "DONE", title: "Done", status: "DONE", cards: [] },
  ]);
  const [dragState, setDragState] = useState<DragState>(null);
  const dragStateRef = useRef<DragState>(null);
  dragStateRef.current = dragState;

  const [loading, setLoading] = useState(true);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [orgMembers, setOrgMembers] = useState<Membership[]>([]);

  // New Project form state
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  // Fetch organization members to reflect who is in this org
  const fetchOrgMembers = useCallback(async () => {
    if (!activeOrg) return;
    try {
      const res = await api.get(`/organizations/${activeOrg._id}/members`);
      if (res.data.success && Array.isArray(res.data.data)) {
        setOrgMembers(res.data.data);
      }
    } catch {
      // Ignore
    }
  }, [activeOrg]);

  useEffect(() => {
    fetchOrgMembers();
  }, [fetchOrgMembers]);

  // Map backend Task to Cult UI CardData
  const mapTaskToCard = useCallback((task: Task): CardData => {
    let assigneeName: string | undefined;
    let assigneeAvatar: string | undefined;

    // 1. Check populated task.assignee
    const populated = (task as any).assignee;
    if (populated && typeof populated === "object") {
      assigneeName = populated.name;
      assigneeAvatar = populated.avatarUrl;
    } else if (task.assigneeId) {
      // 2. Check task.assigneeId object
      if (typeof task.assigneeId === "object") {
        assigneeName = (task.assigneeId as any).name;
        assigneeAvatar = (task.assigneeId as any).avatarUrl;
      } else {
        // 3. Resolve from loaded orgMembers
        const member = orgMembers.find(
          (m) => m.userId?._id?.toString() === task.assigneeId?.toString()
        );
        if (member?.userId) {
          assigneeName = member.userId.name;
          assigneeAvatar = member.userId.avatarUrl;
        }
      }
    }

    return {
      id: task._id,
      title: task.title,
      tags: (task.labels || []).map((l) => ({
        label: l,
        variant: "feature",
      })),
      assignee: assigneeName ? { name: assigneeName, avatar: assigneeAvatar } : undefined,
      date: task.dueDate
        ? new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })
        : undefined,
      priority: task.priority,
      position: task.position,
      rawTask: task,
    };
  }, [orgMembers]);

  // 1. Fetch available projects for current activeOrg
  const fetchOrgProjects = useCallback(async () => {
    if (!activeOrg) return;
    try {
      const res = await api.get("/projects");
      if (res.data.success) {
        const list: Project[] = Array.isArray(res.data.data) ? res.data.data : [];
        setProjects(list);

        // If routeProjectId is passed and exists in list, use it
        if (routeProjectId && list.some((p) => p._id === routeProjectId)) {
          setCurrentProjectId(routeProjectId);
        } else if (list.length > 0) {
          // If no routeProjectId, select first project
          const firstId = list[0]._id;
          setCurrentProjectId(firstId);
          navigate(`/board/${firstId}`, { replace: true });
        } else {
          setCurrentProjectId(null);
          setColumns([
            { id: "TODO", title: "To Do", status: "TODO", cards: [] },
            { id: "IN_PROGRESS", title: "In Progress", status: "IN_PROGRESS", cards: [] },
            { id: "REVIEW", title: "Review", status: "REVIEW", cards: [] },
            { id: "DONE", title: "Done", status: "DONE", cards: [] },
          ]);
          setLoading(false);
          navigate("/board", { replace: true });
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load projects");
      setLoading(false);
    }
  }, [activeOrg, routeProjectId, navigate]);

  useEffect(() => {
    fetchOrgProjects();
  }, [fetchOrgProjects]);

  // Keep route in sync when route param changes
  useEffect(() => {
    if (routeProjectId) {
      setCurrentProjectId(routeProjectId);
    }
  }, [routeProjectId]);

  // 2. Fetch Board data when currentProjectId changes
  const fetchBoardData = useCallback(async () => {
    if (!currentProjectId || !activeOrg) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Fetch project details and tasks in parallel, safely
      const [projRes, tasksRes] = await Promise.allSettled([
        api.get(`/projects/${currentProjectId}`),
        api.get(`/tasks?organizationId=${activeOrg._id}&projectId=${currentProjectId}&limit=100`),
      ]);

      if (projRes.status === "fulfilled" && projRes.value.data?.success) {
        setProject(projRes.value.data.data);
      }

      if (tasksRes.status === "fulfilled" && tasksRes.value.data?.success) {
        const tasks: Task[] = tasksRes.value.data.data;

        // Group into columns
        const nextCols: ColumnData[] = STATUS_COLUMNS.map((colDef) => {
          const colTasks = tasks
            .filter((t) => t.status === colDef.id)
            .sort((a, b) => (a.position || 0) - (b.position || 0));

          return {
            id: colDef.id,
            title: colDef.title,
            status: colDef.id,
            cards: colTasks.map(mapTaskToCard),
          };
        });

        setColumns(nextCols);
      } else if (tasksRes.status === "rejected") {
        toast.error(tasksRes.reason?.response?.data?.message || "Failed to load board tasks");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load board tasks");
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, activeOrg, mapTaskToCard]);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  // 3. Socket.IO Room & Realtime Events
  useEffect(() => {
    if (!currentProjectId) return;

    const socket = getSocket();
    socket.emit("project:join", currentProjectId);

    const handleTaskCreated = (payload: { task: Task; actorId: string }) => {
      const card = mapTaskToCard(payload.task);
      setColumns((prev) =>
        prev.map((col) => {
          if (col.id === payload.task.status) {
            // Deduplicate if card is already present
            if (col.cards.some((c) => c.id === card.id)) return col;
            return { ...col, cards: [...col.cards, card] };
          }
          return col;
        })
      );
    };

    const handleTaskMoved = (payload: { task: Task; actorId: string; changes: any }) => {
      // Don't interrupt if currently dragging this specific card on this device
      if (dragStateRef.current?.cardId === payload.task._id) return;

      const updatedCard = mapTaskToCard(payload.task);
      setColumns((prev) =>
        prev.map((col) => {
          const filtered = col.cards.filter((c) => c.id !== payload.task._id);
          if (col.id === payload.task.status) {
            const newCards = [...filtered, updatedCard].sort(
              (a, b) => (a.position || 0) - (b.position || 0)
            );
            return { ...col, cards: newCards };
          }
          return { ...col, cards: filtered };
        })
      );
    };

    const handleTaskUpdated = (payload: { task: Task; actorId: string }) => {
      if (dragStateRef.current?.cardId === payload.task._id) return;

      const updatedCard = mapTaskToCard(payload.task);
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          cards: col.cards.map((c) => (c.id === payload.task._id ? updatedCard : c)),
        }))
      );
    };

    const handleTaskDeleted = (payload: { taskId: string; actorId: string }) => {
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          cards: col.cards.filter((c) => c.id !== payload.taskId),
        }))
      );
    };

    const handleReconnect = () => {
      socket.emit("project:join", currentProjectId);
      fetchBoardData();
    };

    socket.on("task:created", handleTaskCreated);
    socket.on("task:moved", handleTaskMoved);
    socket.on("task:updated", handleTaskUpdated);
    socket.on("task:deleted", handleTaskDeleted);
    socket.on("connect", handleReconnect);

    return () => {
      socket.emit("project:leave", currentProjectId);
      socket.off("task:created", handleTaskCreated);
      socket.off("task:moved", handleTaskMoved);
      socket.off("task:updated", handleTaskUpdated);
      socket.off("task:deleted", handleTaskDeleted);
      socket.off("connect", handleReconnect);
    };
  }, [currentProjectId, user, fetchBoardData]);

  // Handle Drag & Drop with Optimistic UI & Rollback on 403
  const handleDrop = useCallback(
    async (cardId: string, fromColumnId: ColumnStatus, toColumnId: ColumnStatus) => {
      const previousColumns = columns;

      const fromCol = columns.find((c) => c.id === fromColumnId);
      const card = fromCol?.cards.find((c) => c.id === cardId);
      if (!card) return;

      const targetCol = columns.find((c) => c.id === toColumnId);
      const targetCards = targetCol ? targetCol.cards.filter((c) => c.id !== cardId) : [];

      let newPosition = 1000;
      if (targetCards.length > 0) {
        const lastCard = targetCards[targetCards.length - 1];
        newPosition = (lastCard.position || 0) + 1000;
      }

      // Optimistic update
      setColumns((prev) => {
        return prev.map((col) => {
          if (col.id === fromColumnId && col.id === toColumnId) return col;
          if (col.id === fromColumnId) {
            return {
              ...col,
              cards: col.cards.filter((c) => c.id !== cardId),
            };
          }
          if (col.id === toColumnId) {
            return {
              ...col,
              cards: [...col.cards.filter((c) => c.id !== cardId), { ...card, position: newPosition }],
            };
          }
          return col;
        });
      });

      // Persist move
      try {
        await api.put(`/tasks/${cardId}`, {
          status: toColumnId,
          position: newPosition,
        });
      } catch (err: any) {
        // Rollback on 403 or error
        setColumns(previousColumns);
        const errorMsg =
          err.response?.status === 403
            ? "Permission denied: Members can only move tasks assigned to them."
            : err.response?.data?.message || "Failed to move task. Reverted.";
        toast.error(errorMsg);
      }
    },
    [columns]
  );

  const handleCardClick = (card: CardData) => {
    setSelectedTaskId(card.id);
    setDetailOpen(true);
  };

  const handleProjectSelect = (projId: string) => {
    setCurrentProjectId(projId);
    navigate(`/board/${projId}`);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      setCreatingProject(true);
      const res = await api.post("/projects", {
        organizationId: activeOrg?._id,
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
      });
      if (res.data.success) {
        toast.success("Project created successfully");
        setCreateProjectOpen(false);
        setNewProjectName("");
        setNewProjectDesc("");
        await fetchOrgProjects();
        setCurrentProjectId(res.data.data._id);
        navigate(`/board/${res.data.data._id}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create project");
    } finally {
      setCreatingProject(false);
    }
  };

  // If no projects in org
  if (!loading && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 border border-dashed rounded-xl max-w-lg mx-auto bg-muted/10 space-y-4">
        <div className="p-3 rounded-xl bg-primary/10 text-primary">
          <Kanban className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-base font-semibold">No Projects in {activeOrg?.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Create your first project to unlock the interactive real-time Kanban board.
          </p>
        </div>
        <Button onClick={() => setCreateProjectOpen(true)} className="gap-1.5 text-xs font-semibold">
          <Plus className="h-4 w-4" />
          <span>Create Project</span>
        </Button>

        {/* Dialog for creating project */}
        <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreateProject}>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
                <DialogDescription>
                  Add a new project board to {activeOrg?.name}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-4">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">Project Name</Label>
                  <Input
                    placeholder="e.g. Core Platform"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-semibold">Description (optional)</Label>
                  <Input
                    placeholder="Brief description..."
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateProjectOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creatingProject || !newProjectName.trim()}>
                  {creatingProject ? "Creating..." : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Board Header with Project Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Kanban className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Kanban Board
              </h2>

              {/* Project Switcher Select */}
              {projects.length > 0 && currentProjectId && (
                <Select value={currentProjectId} onValueChange={handleProjectSelect}>
                  <SelectTrigger className="h-8 w-56 text-xs font-semibold bg-background">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p._id} value={p._id} className="text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {project?.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{project.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Org Team Avatars reflection */}
          {orgMembers.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 border-r border-border pr-3">
              <div className="flex -space-x-1.5 overflow-hidden items-center">
                {orgMembers.slice(0, 5).map((m) => (
                  <div
                    key={m._id}
                    title={`${m.userId?.name || "Member"} (${m.role})`}
                    className="relative inline-flex h-6 w-6 items-center justify-center rounded-full border border-background bg-muted text-[9px] font-bold text-foreground shadow-xs"
                  >
                    {m.userId?.avatarUrl ? (
                      <img src={m.userId.avatarUrl} alt={m.userId.name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      (m.userId?.name || "U").slice(0, 2).toUpperCase()
                    )}
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">
                {orgMembers.length} {orgMembers.length === 1 ? "member" : "members"}
              </span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={fetchBoardData}
            className="h-8 gap-1 text-xs"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          {currentProjectId && (
            <Button
              size="sm"
              onClick={() => setCreateTaskOpen(true)}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <Plus className="h-4 w-4" />
              <span>New Task</span>
            </Button>
          )}
        </div>
      </div>

      {/* Board Layout with Cult UI */}
      {loading && columns.every((c) => c.cards.length === 0) ? (
        <div className="flex h-96 items-center justify-center text-xs text-muted-foreground">
          Loading board tasks...
        </div>
      ) : (
        <MotionConfig transition={gentleSpring}>
          <div className="overflow-x-auto pb-4 no-scrollbar">
            <div className="flex items-start gap-4 min-w-[1100px]">
              {columns.map((col) => (
                <Column
                  key={col.id}
                  column={col}
                  dragState={dragState}
                  onDrop={handleDrop}
                  setDragState={setDragState}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
          </div>
        </MotionConfig>
      )}

      {/* Modals & Sheets */}
      {currentProjectId && (
        <CreateTaskDialog
          open={createTaskOpen}
          onOpenChange={setCreateTaskOpen}
          projectId={currentProjectId}
          onTaskCreated={(newTask) => {
            // Optimistic insert: add task directly into the board without waiting for re-fetch
            if (newTask) {
              const card = mapTaskToCard(newTask);
              setColumns((prev) =>
                prev.map((col) => {
                  if (col.id === (newTask.status || "TODO")) {
                    // Insert at end, avoiding duplicates
                    const already = col.cards.some((c) => c.id === card.id);
                    if (already) return col;
                    return { ...col, cards: [...col.cards, card] };
                  }
                  return col;
                })
              );
            }
            // Background sync to get full populated data (assignee names etc.)
            fetchBoardData();
          }}
        />
      )}

      <TaskDetailSheet
        taskId={selectedTaskId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onTaskUpdated={fetchBoardData}
        onTaskDeleted={() => {
          setSelectedTaskId(null);
          fetchBoardData();
        }}
      />
    </div>
  );
}
