import { Request, Response, NextFunction } from "express";
import { Membership } from "../models/membership.model.js";
import { Organization } from "../models/organization.model.js";
import mongoose from "mongoose";

/**
 * Resolves org context from:
 * 1. :orgId route param
 * 2. x-organization-id header
 * Attaches req.organization and req.membership.
 * Returns 404 (not 403) if no membership exists, to avoid existence leaks.
 */
export async function requireOrgMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }

  const orgId =
    req.params.orgId ||
    (req.baseUrl?.includes("organizations") ? req.params.id : undefined) ||
    (req.headers["x-organization-id"] as string) ||
    req.body?.organizationId ||
    (req.query?.organizationId as string);

  if (!orgId || !mongoose.isValidObjectId(orgId)) {
    res.status(404).json({ success: false, message: "Organization not found" });
    return;
  }

  try {
    const membership = await Membership.findOne({
      userId: user._id,
      organizationId: orgId,
    }).lean();

    if (!membership) {
      res.status(404).json({ success: false, message: "Organization not found" });
      return;
    }

    (req as any).membership = membership;
    (req as any).organizationId = orgId;
    next();
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

/**
 * Derive org from a project's organizationId.
 * Use after loading project.
 */
export async function requireOrgMemberFromProject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = (req as any).user;
  const project = (req as any).project;

  if (!project) {
    res.status(404).json({ success: false, message: "Project not found" });
    return;
  }

  try {
    const membership = await Membership.findOne({
      userId: user._id,
      organizationId: project.organizationId,
    }).lean();

    if (!membership) {
      res.status(404).json({ success: false, message: "Project not found" });
      return;
    }

    (req as any).membership = membership;
    (req as any).organizationId = project.organizationId.toString();
    next();
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}
