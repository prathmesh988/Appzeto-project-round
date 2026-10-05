import { useState, useEffect, useCallback } from "react";
import {
  ScrollText,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Clock,
  User,
  ShieldAlert,
} from "lucide-react";
import api from "@/lib/api";
import { useOrgStore } from "@/stores/orgStore";
import { AuditLog } from "@/types";
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

export function AuditLogsPage() {
  const { activeOrg } = useOrgStore();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Filters
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [textSearch, setTextSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
  });

  const isOwnerOrAdmin =
    activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";

  const fetchLogs = useCallback(
    async (pageToFetch: number = page) => {
      if (!activeOrg || !isOwnerOrAdmin) return;
      try {
        setLoading(true);
        const params: Record<string, any> = {
          organizationId: activeOrg._id,
          page: pageToFetch,
          limit: 20,
        };

        if (actionFilter !== "all") params.action = actionFilter;
        if (entityFilter !== "all") params.entity = entityFilter;
        if (textSearch.trim()) params.q = textSearch.trim();

        const res = await api.get("/audit-logs", { params });
        if (res.data.success) {
          setLogs(res.data.data);
          setPagination(res.data.pagination);
          setPage(pageToFetch);
        }
      } catch (err) {
        console.error("Failed to load audit logs", err);
      } finally {
        setLoading(false);
      }
    },
    [activeOrg, isOwnerOrAdmin, actionFilter, entityFilter, textSearch, page]
  );

  useEffect(() => {
    fetchLogs(1);
  }, [activeOrg, actionFilter, entityFilter]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isOwnerOrAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 border border-dashed rounded-xl max-w-md mx-auto mt-12 bg-muted/20">
        <ShieldAlert className="h-10 w-10 text-destructive mb-2" />
        <h3 className="text-base font-semibold mb-1">Access Restricted</h3>
        <p className="text-xs text-muted-foreground">
          Audit logs are restricted to Organization Owners and Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            <span>Audit Logs</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Immutable append-only activity trail for all operations in {activeOrg?.name}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Action Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Filter by Action
            </label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="TASK_CREATED">TASK_CREATED</SelectItem>
                <SelectItem value="TASK_UPDATED">TASK_UPDATED</SelectItem>
                <SelectItem value="TASK_STATUS_CHANGED">TASK_STATUS_CHANGED</SelectItem>
                <SelectItem value="TASK_DELETED">TASK_DELETED</SelectItem>
                <SelectItem value="COMMENT_ADDED">COMMENT_ADDED</SelectItem>
                <SelectItem value="ATTACHMENT_ADDED">ATTACHMENT_ADDED</SelectItem>
                <SelectItem value="PROJECT_CREATED">PROJECT_CREATED</SelectItem>
                <SelectItem value="MEMBER_ADDED">MEMBER_ADDED</SelectItem>
                <SelectItem value="MEMBER_REMOVED">MEMBER_REMOVED</SelectItem>
                <SelectItem value="MEMBER_ROLE_CHANGED">MEMBER_ROLE_CHANGED</SelectItem>
                <SelectItem value="ORG_CREATED">ORG_CREATED</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Entity Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Filter by Entity
            </label>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="membership">Membership</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Search Action / Entity
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Search..."
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchLogs(1);
                }}
                className="h-8 text-xs"
              />
              <Button size="sm" variant="secondary" onClick={() => fetchLogs(1)} className="h-8 text-xs">
                Filter
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-xs font-semibold">Timestamp</TableHead>
              <TableHead className="text-xs font-semibold">Actor</TableHead>
              <TableHead className="text-xs font-semibold">Action</TableHead>
              <TableHead className="text-xs font-semibold">Entity</TableHead>
              <TableHead className="text-xs font-semibold">Entity ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                  Loading audit logs...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                  No audit logs recorded matching your filter.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const isExpanded = !!expandedRows[log._id];
                const hasDiff = !!(log.oldValue || log.newValue);

                return (
                  <>
                    <TableRow
                      key={log._id}
                      onClick={() => hasDiff && toggleRow(log._id)}
                      className={`${hasDiff ? "cursor-pointer" : ""} hover:bg-muted/40 transition-colors`}
                    >
                      <TableCell className="p-2">
                        {hasDiff && (
                          <button
                            type="button"
                            className="p-1 rounded text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {log.userId?.name || "System Actor"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground uppercase font-semibold text-[11px]">
                        {log.entity}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {log.entityId}
                      </TableCell>
                    </TableRow>

                    {/* Expandable diff view */}
                    {isExpanded && hasDiff && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={6} className="p-4">
                          <div className="rounded-lg border border-border/80 bg-background p-3 text-xs space-y-2">
                            <div className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                              Mutation Value Diff:
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                              {log.oldValue && (
                                <div className="rounded border border-red-500/30 bg-red-500/5 p-2 text-destructive overflow-x-auto">
                                  <div className="font-bold text-[10px] text-red-600 mb-1">OLD VALUE:</div>
                                  <pre className="whitespace-pre-wrap">
                                    {JSON.stringify(log.oldValue, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.newValue && (
                                <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2 text-emerald-600 dark:text-emerald-400 overflow-x-auto">
                                  <div className="font-bold text-[10px] text-emerald-600 dark:text-emerald-400 mb-1">
                                    NEW VALUE:
                                  </div>
                                  <pre className="whitespace-pre-wrap">
                                    {JSON.stringify(log.newValue, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination controls */}
        <div className="flex items-center justify-between border-t border-border p-3 text-xs text-muted-foreground">
          <div>
            Showing page {pagination.page} (Total {pagination.total} audit logs)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fetchLogs(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fetchLogs(pagination.page + 1)}
              disabled={!pagination.hasMore || loading}
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
