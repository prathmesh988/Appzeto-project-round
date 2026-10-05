import { Request, Response, NextFunction } from "express";
import { MemberRole } from "../models/membership.model.js";

// Central permission matrix
// ctx allows passing additional context (e.g., assigneeId for MEMBER self-edit)
export type PermissionAction =
  | "view"
  | "create_task"
  | "edit_task"
  | "delete_task"
  | "comment"
  | "create_project"
  | "edit_project"
  | "archive_project"
  | "manage_members"
  | "view_audit_logs"
  | "delete_org"
  | "transfer_ownership";

interface PermissionCtx {
  assigneeId?: string;
  actorId?: string;
}

export function can(role: MemberRole, action: PermissionAction, ctx?: PermissionCtx): boolean {
  switch (action) {
    case "view":
      return true; // All roles can view

    case "create_task":
      return ["MEMBER", "ADMIN", "OWNER"].includes(role);

    case "edit_task":
      if (["ADMIN", "OWNER"].includes(role)) return true;
      if (role === "MEMBER") {
        // MEMBER can only edit tasks assigned to themselves
        return !!(ctx?.assigneeId && ctx?.actorId && ctx.assigneeId === ctx.actorId);
      }
      return false;

    case "comment":
      return ["MEMBER", "ADMIN", "OWNER"].includes(role);

    case "delete_task":
      return ["ADMIN", "OWNER"].includes(role);

    case "create_project":
    case "edit_project":
    case "archive_project":
      return ["ADMIN", "OWNER"].includes(role);

    case "manage_members":
      return ["ADMIN", "OWNER"].includes(role);

    case "view_audit_logs":
      return ["ADMIN", "OWNER"].includes(role);

    case "delete_org":
    case "transfer_ownership":
      return role === "OWNER";

    default:
      return false;
  }
}

// Middleware factory
export function requirePermission(
  action: PermissionAction,
  getCtx?: (req: Request) => PermissionCtx
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const membership = (req as any).membership;
    if (!membership) {
      res.status(403).json({ success: false, message: "No membership context" });
      return;
    }

    const ctx = getCtx ? getCtx(req) : undefined;
    const allowed = can(membership.role as MemberRole, action, ctx);

    if (!allowed) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }

    next();
  };
}
