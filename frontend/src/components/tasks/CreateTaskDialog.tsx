import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useOrgStore } from "@/stores/orgStore";
import { Membership, TaskPriority } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onTaskCreated?: (task: any) => void;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  onTaskCreated,
}: CreateTaskDialogProps) {
  const { activeOrg } = useOrgStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");
  const [dueDate, setDueDate] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeOrg || !open) return;
    const fetchMembers = async () => {
      try {
        const res = await api.get(`/organizations/${activeOrg._id}/members`);
        if (res.data.success) {
          setMembers(res.data.data);
        }
      } catch (err) {
        console.error("Failed to load org members", err);
      }
    };
    fetchMembers();
  }, [activeOrg, open]);

  const handleAddLabel = () => {
    const trimmed = labelInput.trim();
    if (trimmed && !labels.includes(trimmed)) {
      setLabels([...labels, trimmed]);
      setLabelInput("");
    }
  };

  const handleRemoveLabel = (label: string) => {
    setLabels(labels.filter((l) => l !== label));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.post("/tasks", {
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assigneeId: assigneeId !== "unassigned" ? assigneeId : undefined,
        dueDate: dueDate || undefined,
        labels,
      });

      if (res.data.success) {
        toast.success(`Task "${title.trim()}" created successfully!`);
        // Reset form
        setTitle("");
        setDescription("");
        setPriority("MEDIUM");
        setAssigneeId("unassigned");
        setDueDate("");
        setLabels([]);
        onOpenChange(false);
        // Pass created task directly so board can add it without re-fetch
        onTaskCreated?.(res.data.data);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to create task";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a task to the project board.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-2 rounded-md bg-destructive/15 p-2 text-xs font-medium text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-3 py-3">
            <div className="grid gap-1.5">
              <Label htmlFor="task-title" className="text-xs font-semibold">Title</Label>
              <Input
                id="task-title"
                placeholder="What needs to be done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="task-desc" className="text-xs font-semibold">Description</Label>
              <textarea
                id="task-desc"
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Detailed description or acceptance criteria..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger className="h-9 text-xs">
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

              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Assignee</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Assign to..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.userId._id} value={m.userId._id}>
                        {m.userId.name} ({m.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="task-due" className="text-xs font-semibold">Due Date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Labels */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Labels</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. backend, bug, ui"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddLabel();
                    }
                  }}
                  className="text-xs"
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleAddLabel}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {labels.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {labels.map((l) => (
                    <Badge key={l} variant="secondary" className="text-xs gap-1 py-0.5">
                      {l}
                      <button type="button" onClick={() => handleRemoveLabel(l)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
