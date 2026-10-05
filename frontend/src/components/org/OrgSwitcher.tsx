import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus, Building2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useOrgStore } from "@/stores/orgStore";
import api from "@/lib/api";
import { Organization } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Badge } from "@/components/ui/badge";

export function OrgSwitcher() {
  const { activeOrg, setActiveOrg, clearActiveOrg } = useOrgStore();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Join Org state
  const [joinSlug, setJoinSlug] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const fetchOrgs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/organizations");
      if (res.data.success && res.data.data) {
        const orgList: Organization[] = res.data.data;
        setOrgs(orgList);
        if (!activeOrg && orgList.length > 0) {
          setActiveOrg(orgList[0]);
        } else if (activeOrg) {
          // Sync role or data if updated
          const current = orgList.find((o) => o._id === activeOrg._id);
          if (current) {
            setActiveOrg(current);
          } else if (orgList.length > 0) {
            // Stale or switched account - fallback to first valid org
            setActiveOrg(orgList[0]);
          } else {
            clearActiveOrg();
          }
        }
      }
    } catch (err) {
      console.error("Failed to load organizations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewOrgName(val);
    setNewOrgSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    try {
      setCreating(true);
      setError(null);
      const res = await api.post("/organizations", {
        name: newOrgName.trim(),
        slug: newOrgSlug.trim() || newOrgName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      });
      if (res.data.success) {
        const createdOrg = res.data.data;
        setCreateDialogOpen(false);
        setNewOrgName("");
        setNewOrgSlug("");
        toast.success(`Organization "${createdOrg.name}" created!`);
        await fetchOrgs();
        setActiveOrg(createdOrg);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinSlug.trim()) return;
    try {
      setJoining(true);
      setJoinError(null);
      const res = await api.post("/organizations/join", {
        slug: joinSlug.trim().toLowerCase(),
      });
      if (res.data.success) {
        const joinedOrg = res.data.data;
        setJoinDialogOpen(false);
        setJoinSlug("");
        toast.success(`Joined "${joinedOrg.name}" successfully!`);
        await fetchOrgs();
        setActiveOrg(joinedOrg);
      }
    } catch (err: any) {
      setJoinError(err.response?.data?.message || "Failed to join organization");
    } finally {
      setJoining(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "OWNER":
        return "default";
      case "ADMIN":
        return "secondary";
      case "MEMBER":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 p-2 text-left text-sm transition-all hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring">
            <div className="flex items-center gap-2.5 truncate">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold text-xs shadow-xs">
                {activeOrg?.name ? activeOrg.name.slice(0, 2).toUpperCase() : <Building2 className="h-4 w-4" />}
              </div>
              <div className="flex flex-col truncate">
                <span className="font-semibold text-xs truncate leading-tight text-foreground">
                  {activeOrg ? activeOrg.name : "Select Org"}
                </span>
                {activeOrg && (
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    {activeOrg.role}
                  </span>
                )}
              </div>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Organizations
          </DropdownMenuLabel>
          {orgs.map((org) => {
            const isSelected = activeOrg?._id === org._id;
            return (
              <DropdownMenuItem
                key={org._id}
                onClick={() => setActiveOrg(org)}
                className="flex items-center justify-between py-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-bold">
                    {org.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium truncate">{org.name}</span>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  <Badge variant={getRoleBadgeVariant(org.role)} className="text-[9px] px-1 py-0 h-4">
                    {org.role}
                  </Badge>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center gap-2 text-xs py-2 cursor-pointer text-primary font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Create organization</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setJoinDialogOpen(true)}
            className="flex items-center gap-2 text-xs py-2 cursor-pointer text-foreground font-medium"
          >
            <UserPlus className="h-4 w-4" />
            <span>Join organization</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Org Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateOrg}>
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
              <DialogDescription>
                Create a new workspace to manage your projects, teams, and tasks.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="mt-3 rounded-md bg-destructive/15 p-2 text-xs font-medium text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="org-name" className="text-xs font-semibold">
                  Organization Name
                </Label>
                <Input
                  id="org-name"
                  placeholder="e.g. Acme Innovations"
                  value={newOrgName}
                  onChange={handleNameChange}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="org-slug" className="text-xs font-semibold">
                  URL Slug
                </Label>
                <Input
                  id="org-slug"
                  placeholder="e.g. acme-innovations"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  required
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
              <Button type="submit" disabled={creating || !newOrgName.trim()}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Join Org Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleJoinOrg}>
            <DialogHeader>
              <DialogTitle>Join Organization</DialogTitle>
              <DialogDescription>
                Enter the unique organization slug (e.g. globex-corp or acme-innovations) to join as a team member.
              </DialogDescription>
            </DialogHeader>

            {joinError && (
              <div className="mt-3 rounded-md bg-destructive/15 p-2 text-xs font-medium text-destructive">
                {joinError}
              </div>
            )}

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="join-slug" className="text-xs font-semibold">
                  Organization Slug
                </Label>
                <Input
                  id="join-slug"
                  placeholder="e.g. globex-corp"
                  value={joinSlug}
                  onChange={(e) => setJoinSlug(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Ask your organization administrator for the workspace slug.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setJoinDialogOpen(false)}
                disabled={joining}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={joining || !joinSlug.trim()}>
                {joining ? "Joining..." : "Join Organization"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
