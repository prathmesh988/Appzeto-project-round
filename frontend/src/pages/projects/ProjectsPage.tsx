import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FolderKanban,
  Plus,
  ArrowRight,
  Archive,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useOrgStore } from "@/stores/orgStore";
import { Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ProjectsPage() {
  const { activeOrg } = useOrgStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnerOrAdmin =
    activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";

  const fetchProjects = async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      const res = await api.get("/projects");
      if (res.data.success) {
        setProjects(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [activeOrg]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setCreating(true);
      setError(null);
      const res = await api.post("/projects", {
        organizationId: activeOrg?._id,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      if (res.data.success) {
        setName("");
        setDescription("");
        setCreateDialogOpen(false);
        toast.success("Project created successfully");
        fetchProjects();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            <span>Projects</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage and view project boards in {activeOrg?.name}
          </p>
        </div>

        {isOwnerOrAdmin && (
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span>Create Project</span>
          </Button>
        )}
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed rounded-xl p-8 text-center bg-muted/10">
          <FolderKanban className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="text-sm font-semibold mb-1">No Projects Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mb-4">
            {isOwnerOrAdmin
              ? "Create your first project board to start tracking tasks and collaborating."
              : "No projects have been created in this organization yet."}
          </p>
          {isOwnerOrAdmin && (
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              <span>Create Project</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => (
            <Card
              key={p._id}
              className="group hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between"
            >
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold group-hover:text-primary transition-colors">
                        {p.name}
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        Created {new Date(p.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                  {p.archived && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      <Archive className="h-3 w-3" />
                      <span>Archived</span>
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-5 pt-0 pb-3 flex-1">
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {p.description || "No description provided."}
                </p>
              </CardContent>

              <CardFooter className="p-5 pt-3 border-t border-border/50 bg-muted/10 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Kanban Board</span>
                </span>
                <Link
                  to={`/projects/${p._id}`}
                  className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline"
                >
                  <span>Open Board</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <form onSubmit={handleCreateProject}>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Add a new project board to {activeOrg?.name}
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="mt-2 rounded-md bg-destructive/15 p-2 text-xs font-medium text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-3 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="proj-name" className="text-xs font-semibold">
                  Project Name
                </Label>
                <Input
                  id="proj-name"
                  placeholder="e.g. Website Redesign"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="proj-desc" className="text-xs font-semibold">
                  Description
                </Label>
                <textarea
                  id="proj-desc"
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Goals and scope for this project..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
