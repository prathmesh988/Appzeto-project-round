import { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Send,
  Paperclip,
  Trash2,
  Calendar,
  User as UserIcon,
  Clock,
  Download,
  AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useOrgStore } from "@/stores/orgStore";
import { Task, Comment, AuditLog, Membership, TaskStatus, TaskPriority } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TaskDetailSheetProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: () => void;
  onTaskDeleted?: () => void;
}

export function TaskDetailSheet({
  taskId,
  open,
  onOpenChange,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailSheetProps) {
  const { user } = useAuthStore();
  const { activeOrg } = useOrgStore();

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");
  const [dueDate, setDueDate] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [labels, setLabels] = useState<string[]>([]);

  // Comment state
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<Membership[]>([]);
  const [showMentions, setShowMentions] = useState(false);

  // Attachment upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Permission helpers
  const userRole = activeOrg?.role || "VIEWER";
  const isOwnerOrAdmin = userRole === "OWNER" || userRole === "ADMIN";
  const isAssignee =
    task?.assigneeId &&
    (typeof task.assigneeId === "string"
      ? task.assigneeId === user?._id
      : task.assigneeId._id === user?._id);

  // VIEWER cannot edit. MEMBER can only edit if assigned to them.
  const canEdit = isOwnerOrAdmin || (userRole === "MEMBER" && isAssignee);
  const canReassign = isOwnerOrAdmin;
  const canDelete = isOwnerOrAdmin;
  const canComment = userRole !== "VIEWER";

  useEffect(() => {
    if (!taskId || !open) return;

    const fetchTaskData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Task
        const res = await api.get(`/tasks/${taskId}`);
        if (res.data.success) {
          const t = res.data.data;
          setTask(t);
          setTitle(t.title);
          setDescription(t.description || "");
          setStatus(t.status);
          setPriority(t.priority);
          setAssigneeId(
            t.assigneeId
              ? typeof t.assigneeId === "string"
                ? t.assigneeId
                : t.assigneeId._id
              : "unassigned"
          );
          setDueDate(t.dueDate ? t.dueDate.split("T")[0] : "");
          setLabels(t.labels || []);
        }

        // 2. Fetch Comments
        try {
          const comRes = await api.get(`/tasks/${taskId}/comments`);
          if (comRes.data.success) {
            setComments(comRes.data.data);
          }
        } catch {}

        // 3. Fetch Audit Logs for task activity history (if ADMIN or OWNER)
        if (isOwnerOrAdmin && activeOrg) {
          try {
            const auditRes = await api.get(
              `/audit-logs?organizationId=${activeOrg._id}&entity=task&entityId=${taskId}&limit=50`
            );
            if (auditRes.data.success) {
              setAuditLogs(auditRes.data.data);
            }
          } catch {}
        }

        // 4. Fetch Members for assignee dropdown & mentions
        if (activeOrg) {
          try {
            const memRes = await api.get(`/organizations/${activeOrg._id}/members`);
            if (memRes.data.success) {
              setMembers(memRes.data.data);
            }
          } catch {}
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load task");
      } finally {
        setLoading(false);
      }
    };

    fetchTaskData();
  }, [taskId, open, activeOrg]);

  const handleSaveFields = async (updates: Partial<Task>) => {
    if (!task) return;
    try {
      setSaving(true);
      const res = await api.put(`/tasks/${task._id}`, updates);
      if (res.data.success) {
        setTask(res.data.data);
        onTaskUpdated?.();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update task");
    } finally {
      setSaving(false);
    }
  };

  const handleAddLabel = () => {
    const trimmed = labelInput.trim();
    if (trimmed && !labels.includes(trimmed)) {
      const nextLabels = [...labels, trimmed];
      setLabels(nextLabels);
      setLabelInput("");
      handleSaveFields({ labels: nextLabels });
    }
  };

  const handleRemoveLabel = (label: string) => {
    const nextLabels = labels.filter((l) => l !== label);
    setLabels(nextLabels);
    handleSaveFields({ labels: nextLabels });
  };

  // Comments with @mentions
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewComment(value);

    // Check if user is typing @
    const cursor = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf("@");

    if (lastAt !== -1 && lastAt === textBeforeCursor.length - 1) {
      setMentionSuggestions(members);
      setShowMentions(true);
    } else if (lastAt !== -1 && lastAt < cursor) {
      const query = textBeforeCursor.slice(lastAt + 1).toLowerCase();
      if (!query.includes(" ")) {
        setMentionSuggestions(
          members.filter(
            (m) =>
              m.userId.name.toLowerCase().includes(query) ||
              m.userId.email.toLowerCase().includes(query)
          )
        );
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (memberEmail: string) => {
    const lastAt = newComment.lastIndexOf("@");
    if (lastAt !== -1) {
      const updated = newComment.slice(0, lastAt) + `@${memberEmail} ` + newComment.slice(lastAt + 1);
      setNewComment(updated);
    }
    setShowMentions(false);
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !task) return;

    try {
      setSendingComment(true);
      const res = await api.post(`/tasks/${task._id}/comments`, {
        body: newComment.trim(),
      });
      if (res.data.success) {
        setComments([...comments, res.data.data]);
        setNewComment("");
        setShowMentions(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to post comment");
    } finally {
      setSendingComment(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadingFile(true);
      const res = await api.post(`/tasks/${task._id}/attachments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        // Refresh task to get new attachments list
        const refreshed = await api.get(`/tasks/${task._id}`);
        if (refreshed.data.success) {
          setTask(refreshed.data.data);
          onTaskUpdated?.();
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to upload file");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (!window.confirm(`Are you sure you want to delete "${task.title}"?`)) return;

    try {
      setLoading(true);
      const res = await api.delete(`/tasks/${task._id}`);
      if (res.data.success) {
        onOpenChange(false);
        onTaskDeleted?.();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col h-full bg-background overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8 text-xs text-muted-foreground">
            Loading task details...
          </div>
        ) : task ? (
          <>
            {/* Sheet Header */}
            <div className="p-5 border-b border-border bg-card shrink-0">
              <SheetHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    {canEdit ? (
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => handleSaveFields({ title })}
                        className="text-base font-bold tracking-tight border-transparent hover:border-border focus:border-border h-auto py-1 px-1.5 -ml-1.5"
                      />
                    ) : (
                      <SheetTitle className="text-base font-bold text-left">{task.title}</SheetTitle>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Task in Project</span>
                      <span>•</span>
                      <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDeleteTask}
                      className="text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0"
                      title="Delete task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </SheetHeader>

              {error && (
                <div className="mt-3 rounded-md bg-destructive/15 p-2 text-xs font-medium text-destructive flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Status and Priority Row */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </Label>
                  <Select
                    value={status}
                    onValueChange={(val) => {
                      setStatus(val as TaskStatus);
                      handleSaveFields({ status: val as TaskStatus });
                    }}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODO">To Do</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="REVIEW">Review</SelectItem>
                      <SelectItem value="DONE">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Priority
                  </Label>
                  <Select
                    value={priority}
                    onValueChange={(val) => {
                      setPriority(val as TaskPriority);
                      handleSaveFields({ priority: val as TaskPriority });
                    }}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Assignee & Due Date Row */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Assignee
                  </Label>
                  <Select
                    value={assigneeId}
                    onValueChange={(val) => {
                      setAssigneeId(val);
                      handleSaveFields({ assigneeId: val !== "unassigned" ? val : null });
                    }}
                    disabled={!canReassign}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.userId._id} value={m.userId._id}>
                          {m.userId.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Due Date
                  </Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      handleSaveFields({ dueDate: e.target.value || null });
                    }}
                    disabled={!canEdit}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Tabbed Content Area */}
            <div className="flex-1 overflow-y-auto">
              <Tabs defaultValue="details" className="w-full">
                <div className="px-5 pt-3 border-b border-border bg-card">
                  <TabsList className="bg-muted/60 p-0.5 h-8">
                    <TabsTrigger value="details" className="text-xs py-1 px-3">
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="text-xs py-1 px-3">
                      Comments ({comments.length})
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="text-xs py-1 px-3">
                      Activity
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* DETAILS TAB */}
                <TabsContent value="details" className="p-5 space-y-5 m-0">
                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Description</Label>
                    {canEdit ? (
                      <textarea
                        rows={4}
                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Add a detailed description..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={() => handleSaveFields({ description })}
                      />
                    ) : (
                      <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-xs text-foreground whitespace-pre-wrap">
                        {task.description || <span className="text-muted-foreground italic">No description provided</span>}
                      </div>
                    )}
                  </div>

                  {/* Labels */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-foreground">Labels</Label>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {labels.map((l) => (
                        <Badge key={l} variant="secondary" className="text-xs gap-1 py-0.5">
                          {l}
                          {canEdit && (
                            <button type="button" onClick={() => handleRemoveLabel(l)}>
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                      {canEdit && (
                        <div className="flex items-center gap-1.5">
                          <Input
                            placeholder="Add label..."
                            value={labelInput}
                            onChange={(e) => setLabelInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddLabel();
                              }
                            }}
                            className="h-7 w-28 text-[11px]"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={handleAddLabel}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attachments */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground">
                        Attachments ({task.attachments?.length || 0})
                      </Label>
                      {canEdit && (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingFile}
                          >
                            <Paperclip className="h-3 w-3" />
                            <span>{uploadingFile ? "Uploading..." : "Upload file"}</span>
                          </Button>
                        </>
                      )}
                    </div>

                    {task.attachments && task.attachments.length > 0 ? (
                      <div className="divide-y divide-border/60 border rounded-lg bg-card">
                        {task.attachments.map((att, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate font-medium">{att.filename}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                ({Math.round(att.size / 1024)} KB)
                              </span>
                            </div>
                            <a
                              href={`/uploads/${att.storedName}`}
                              target="_blank"
                              rel="noreferrer"
                              download={att.filename}
                              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground shrink-0"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic py-1">
                        No attachments uploaded
                      </p>
                    )}
                  </div>
                </TabsContent>

                {/* COMMENTS TAB */}
                <TabsContent value="comments" className="p-5 flex flex-col space-y-4 m-0">
                  {/* Comments list */}
                  <div className="space-y-3">
                    {comments.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        No comments yet. Start the discussion!
                      </div>
                    ) : (
                      comments.map((c) => (
                        <div key={c._id} className="flex gap-2.5 p-3 rounded-lg border border-border/70 bg-card">
                          <Avatar className="h-7 w-7 shrink-0">
                            {c.authorId?.avatarUrl && (
                              <AvatarImage src={c.authorId.avatarUrl} alt={c.authorId.name} />
                            )}
                            <AvatarFallback className="text-[10px] font-bold">
                              {c.authorId?.name ? c.authorId.name.slice(0, 2).toUpperCase() : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground">
                                {c.authorId?.name || "Unknown"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(c.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                              {c.body}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add comment input */}
                  {canComment && (
                    <div className="pt-2 relative">
                      {showMentions && mentionSuggestions.length > 0 && (
                        <div className="absolute bottom-full mb-1 left-0 z-50 w-64 rounded-md border border-border bg-popover p-1 shadow-md max-h-40 overflow-y-auto">
                          <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1">
                            Mention org member:
                          </div>
                          {mentionSuggestions.map((m) => (
                            <button
                              key={m.userId._id}
                              type="button"
                              onClick={() => insertMention(m.userId.email)}
                              className="w-full flex items-center justify-between px-2 py-1 text-xs hover:bg-muted rounded text-left"
                            >
                              <span className="font-medium text-foreground">{m.userId.name}</span>
                              <span className="text-[10px] text-muted-foreground">@{m.userId.email}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <form onSubmit={handleSendComment} className="flex gap-2">
                        <textarea
                          rows={2}
                          className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="Write a comment... (Type @ to mention members)"
                          value={newComment}
                          onChange={handleCommentChange}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={sendingComment || !newComment.trim()}
                          className="self-end h-8 px-3"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  )}
                </TabsContent>

                {/* ACTIVITY HISTORY TAB */}
                <TabsContent value="activity" className="p-5 space-y-3 m-0">
                  {!isOwnerOrAdmin ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Activity history is visible to Admins and Owners only.
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No activity history recorded for this task.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {auditLogs.map((log) => (
                        <div
                          key={log._id}
                          className="flex items-start gap-2.5 p-3 rounded-lg border border-border/70 bg-card text-xs"
                        >
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground">
                                {log.userId?.name || "System"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-muted-foreground">
                              Action: <span className="font-mono text-foreground font-medium">{log.action}</span>
                            </p>
                            {(log.oldValue || log.newValue) && (
                              <div className="rounded bg-muted/40 p-2 font-mono text-[11px] space-y-1 mt-1">
                                {log.oldValue && (
                                  <div className="text-destructive">
                                    - {JSON.stringify(log.oldValue)}
                                  </div>
                                )}
                                {log.newValue && (
                                  <div className="text-emerald-600 dark:text-emerald-400">
                                    + {JSON.stringify(log.newValue)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
