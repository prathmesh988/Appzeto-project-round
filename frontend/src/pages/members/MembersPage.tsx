import { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Mail,
  MoreVertical,
  Check,
  AlertCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useOrgStore } from "@/stores/orgStore";
import { Membership, Role } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function MembersPage() {
  const { user } = useAuthStore();
  const { activeOrg } = useOrgStore();

  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserRole = activeOrg?.role || "VIEWER";
  const isOwner = currentUserRole === "OWNER";
  const isAdmin = currentUserRole === "ADMIN";
  const canManageMembers = isOwner || isAdmin;

  const fetchMembers = async () => {
    if (!activeOrg) return;
    try {
      setLoading(true);
      const res = await api.get(`/organizations/${activeOrg._id}/members`);
      if (res.data.success) {
        setMembers(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [activeOrg]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !activeOrg) return;

    try {
      setSubmitting(true);
      setError(null);
      const res = await api.post(`/organizations/${activeOrg._id}/members`, {
        email: email.trim(),
        role,
      });
      if (res.data.success) {
        setEmail("");
        setRole("MEMBER");
        setAddDialogOpen(false);
        toast.success("Member added to organization");
        fetchMembers();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to add member");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: Role) => {
    if (!activeOrg) return;
    try {
      const res = await api.patch(
        `/organizations/${activeOrg._id}/members/${targetUserId}`,
        { role: newRole }
      );
      if (res.data.success) {
        toast.success("Role updated successfully");
        fetchMembers();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to change role");
    }
  };

  const handleRemoveMember = async (targetUserId: string, targetName: string) => {
    if (!activeOrg) return;
    if (!window.confirm(`Are you sure you want to remove ${targetName} from the organization?`)) {
      return;
    }

    try {
      const res = await api.delete(
        `/organizations/${activeOrg._id}/members/${targetUserId}`
      );
      if (res.data.success) {
        toast.success("Member removed from organization");
        fetchMembers();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to remove member");
    }
  };

  const getRoleBadge = (r: Role) => {
    switch (r) {
      case "OWNER":
        return <Badge className="bg-primary hover:bg-primary/90 text-xs">Owner</Badge>;
      case "ADMIN":
        return <Badge variant="secondary" className="text-xs">Admin</Badge>;
      case "MEMBER":
        return <Badge variant="outline" className="text-xs">Member</Badge>;
      case "VIEWER":
        return <Badge variant="outline" className="text-xs text-muted-foreground">Viewer</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span>Team Members</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage who has access to {activeOrg?.name} and their workspace roles
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeOrg?.slug && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeOrg.slug);
                toast.success(`Copied organization slug: "${activeOrg.slug}"`);
              }}
              title="Click to copy workspace slug for team members to join"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
            >
              <span className="font-medium text-[11px]">Slug:</span>
              <span className="font-mono text-[11px] font-semibold text-foreground">{activeOrg.slug}</span>
              <Copy className="h-3 w-3 ml-0.5" />
            </button>
          )}

          {canManageMembers && (
            <Button
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Member</span>
            </Button>
          )}
        </div>
      </div>

      {/* Members Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[35%] text-xs font-semibold">User</TableHead>
              <TableHead className="text-xs font-semibold">Email</TableHead>
              <TableHead className="text-xs font-semibold">Current Role</TableHead>
              <TableHead className="text-xs font-semibold">Joined Date</TableHead>
              {canManageMembers && (
                <TableHead className="text-right text-xs font-semibold">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-xs text-muted-foreground">
                  Loading members...
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-xs text-muted-foreground">
                  No members found in this organization.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => {
                const isTargetOwner = m.role === "OWNER";
                const isSelf = m.userId._id === user?._id;

                // ADMIN cannot modify or remove OWNER, and cannot promote to OWNER
                const canModifyThisMember =
                  canManageMembers &&
                  (!isTargetOwner || isOwner) &&
                  (!isSelf || isOwner);

                return (
                  <TableRow key={m._id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-medium text-xs text-foreground">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          {m.userId.avatarUrl && (
                            <AvatarImage src={m.userId.avatarUrl} alt={m.userId.name} />
                          )}
                          <AvatarFallback className="text-[10px] font-bold">
                            {m.userId.name ? m.userId.name.slice(0, 2).toUpperCase() : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <span>{m.userId.name}</span>
                            {isSelf && (
                              <span className="text-[10px] text-muted-foreground font-normal">
                                (You)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {m.userId.email}
                    </TableCell>
                    <TableCell>{getRoleBadge(m.role)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </TableCell>
                    {canManageMembers && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canModifyThisMember && !isTargetOwner && (
                            <Select
                              value={m.role}
                              onValueChange={(newRole) =>
                                handleRoleChange(m.userId._id, newRole as Role)
                              }
                            >
                              <SelectTrigger className="h-7 w-28 text-[11px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {isOwner && <SelectItem value="OWNER">Owner</SelectItem>}
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="MEMBER">Member</SelectItem>
                                <SelectItem value="VIEWER">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          )}

                          {canModifyThisMember && !isSelf && !isTargetOwner && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveMember(m.userId._id, m.userId.name)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Remove member"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Member Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddMember}>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Invite an existing user to join {activeOrg?.name} by email.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="mt-2 rounded-md bg-destructive/15 p-2 text-xs font-medium text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid gap-3 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="member-email" className="text-xs font-semibold">
                  User Email
                </Label>
                <Input
                  id="member-email"
                  type="email"
                  placeholder="e.g. colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Workspace Role</Label>
                <Select value={role} onValueChange={(val) => setRole(val as Role)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {isOwner && <SelectItem value="OWNER">Owner - Full Control</SelectItem>}
                    <SelectItem value="ADMIN">Admin - Manage projects & members</SelectItem>
                    <SelectItem value="MEMBER">Member - Create & edit assigned tasks</SelectItem>
                    <SelectItem value="VIEWER">Viewer - Read-only access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !email.trim()}>
                {submitting ? "Adding..." : "Add Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
