import { Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Organization } from "../models/organization.model.js";
import { Membership } from "../models/membership.model.js";
import { User } from "../models/user.model.js";
import { auditService, AuditActions } from "../services/audit.service.js";
import { notificationService } from "../services/notification.service.js";
import { can } from "../middleware/permissions.js";

const createOrgSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .toLowerCase()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
});

const addMemberSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
});

const updateMemberSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

export const createOrganization = async (req: Request, res: Response): Promise<void> => {
  const parsed = createOrgSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { name, slug } = parsed.data;
  const user = (req as any).user;

  try {
    const existing = await Organization.findOne({ slug }).lean();
    if (existing) {
      res.status(409).json({ success: false, message: "Organization slug already in use" });
      return;
    }

    const org = await Organization.create({
      name,
      slug,
      createdBy: user._id,
    });

    // Creator becomes OWNER
    await Membership.create({
      userId: user._id,
      organizationId: org._id,
      role: "OWNER",
    });

    await auditService.log({
      userId: user._id,
      organizationId: org._id,
      action: AuditActions.ORG_CREATED,
      entity: "organization",
      entityId: org._id,
      newValue: { name, slug },
    });

    res.status(201).json({
      success: true,
      data: {
        _id: org._id,
        name: org.name,
        slug: org.slug,
        role: "OWNER",
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create organization" });
  }
};

export const getMyOrganizations = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;

  try {
    const memberships = await Membership.find({ userId: user._id }).lean();
    const orgIds = memberships.map((m) => m.organizationId);

    const orgs = await Organization.find({ _id: { $in: orgIds } }).lean();
    const roleMap = new Map(memberships.map((m) => [m.organizationId.toString(), m.role]));

    const result = orgs.map((org) => ({
      _id: org._id,
      name: org.name,
      slug: org.slug,
      role: roleMap.get(org._id.toString()),
      createdAt: org.createdAt,
    }));

    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch organizations" });
  }
};

export const getOrgMembers = async (req: Request, res: Response): Promise<void> => {
  const orgId = req.params.id as string;

  try {
    const memberships = await Membership.find({ organizationId: orgId }).lean();
    const userIds = memberships.map((m) => m.userId);

    const users = await User.find({ _id: { $in: userIds } })
      .select("name email avatarUrl")
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const result = memberships.map((m) => ({
      _id: m._id,
      role: m.role,
      createdAt: m.createdAt,
      userId: userMap.get(m.userId.toString()) || { _id: m.userId, name: "Unknown", email: "" },
    }));

    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch members" });
  }
};

export const addMember = async (req: Request, res: Response): Promise<void> => {
  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { email, role } = parsed.data;
  const actorId = (req as any).user._id;
  const orgId = req.params.id as string;
  const actorMembership = (req as any).membership;

  // ADMIN cannot grant OWNER
  if (role === "OWNER") {
    res.status(403).json({ success: false, message: "Cannot grant OWNER role" });
    return;
  }

  // ADMIN cannot add ADMIN level (they can only add MEMBER/VIEWER)
  if (actorMembership.role === "ADMIN" && role === "ADMIN") {
    res.status(403).json({ success: false, message: "ADMIN cannot add another ADMIN" });
    return;
  }

  try {
    const targetUser = await User.findOne({ email }).lean();
    if (!targetUser) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const existing = await Membership.findOne({
      userId: targetUser._id,
      organizationId: orgId,
    }).lean();
    if (existing) {
      res.status(409).json({ success: false, message: "User already a member" });
      return;
    }

    const membership = (await Membership.create({
      userId: targetUser._id,
      organizationId: orgId,
      role,
    })) as any;

    await auditService.log({
      userId: actorId,
      organizationId: orgId,
      action: AuditActions.MEMBER_ADDED,
      entity: "membership",
      entityId: membership._id,
      newValue: { userId: targetUser._id.toString(), role },
    });

    await notificationService.create({
      userId: targetUser._id,
      organizationId: orgId,
      type: "ADDED_TO_ORG",
      message: `You have been added to an organization with role ${role}`,
    });

    res.status(201).json({ success: true, data: membership });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to add member" });
  }
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
  const { id: orgId, userId: targetUserId } = req.params as { id: string; userId: string };
  const actorMembership = (req as any).membership;
  const actorId = (req as any).user._id;

  try {
    const targetMembership = await Membership.findOne({
      organizationId: orgId,
      userId: targetUserId,
    }).lean();

    if (!targetMembership) {
      res.status(404).json({ success: false, message: "Member not found" });
      return;
    }

    // ADMIN cannot remove OWNER or ADMIN
    if (actorMembership.role === "ADMIN" && ["OWNER", "ADMIN"].includes(targetMembership.role)) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }

    // Cannot remove last OWNER
    if (targetMembership.role === "OWNER") {
      const ownerCount = await Membership.countDocuments({
        organizationId: orgId,
        role: "OWNER",
      });
      if (ownerCount <= 1) {
        res.status(403).json({ success: false, message: "Cannot remove the last OWNER" });
        return;
      }
    }

    await Membership.deleteOne({ _id: targetMembership._id });

    await auditService.log({
      userId: actorId,
      organizationId: orgId,
      action: AuditActions.MEMBER_REMOVED,
      entity: "membership",
      entityId: targetMembership._id,
      oldValue: { userId: targetUserId, role: targetMembership.role },
    });

    res.json({ success: true, message: "Member removed" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to remove member" });
  }
};

export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { role: newRole } = parsed.data;
  const { id: orgId, userId: targetUserId } = req.params as { id: string; userId: string };
  const actorMembership = (req as any).membership;
  const actorId = (req as any).user._id;

  try {
    const targetMembership = await Membership.findOne({
      organizationId: orgId,
      userId: targetUserId,
    });
    if (!targetMembership) {
      res.status(404).json({ success: false, message: "Member not found" });
      return;
    }

    // ADMIN cannot modify OWNER or ADMIN
    if (actorMembership.role === "ADMIN" && ["OWNER", "ADMIN"].includes(targetMembership.role)) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }

    // Cannot demote last OWNER
    if (targetMembership.role === "OWNER") {
      const ownerCount = await Membership.countDocuments({
        organizationId: orgId,
        role: "OWNER",
      });
      if (ownerCount <= 1) {
        res.status(403).json({ success: false, message: "Cannot demote the last OWNER" });
        return;
      }
    }

    const oldRole = targetMembership.role;
    targetMembership.role = newRole;
    await targetMembership.save();

    await auditService.log({
      userId: actorId,
      organizationId: orgId,
      action: AuditActions.MEMBER_ROLE_CHANGED,
      entity: "membership",
      entityId: targetMembership._id,
      oldValue: { role: oldRole },
      newValue: { role: newRole },
    });

    res.json({ success: true, data: targetMembership });
  } catch {
    res.status(500).json({ success: false, message: "Failed to update role" });
  }
};

const joinOrgSchema = z.object({
  slug: z.string().min(1).trim().toLowerCase(),
});

export const joinOrganization = async (req: Request, res: Response): Promise<void> => {
  const parsed = joinOrgSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { slug } = parsed.data;
  const user = (req as any).user;

  try {
    const org = await Organization.findOne({ slug: slug.toLowerCase() }).lean();
    if (!org) {
      res.status(404).json({ success: false, message: `Organization with slug "${slug}" not found` });
      return;
    }

    const existingMembership = await Membership.findOne({
      userId: user._id,
      organizationId: org._id,
    }).lean();

    if (existingMembership) {
      res.status(400).json({
        success: false,
        message: `You are already a ${existingMembership.role} of "${org.name}"`,
      });
      return;
    }

    const membership = await Membership.create({
      userId: user._id,
      organizationId: org._id,
      role: "MEMBER",
    });

    await auditService.log({
      userId: user._id,
      organizationId: org._id,
      action: AuditActions.MEMBER_ADDED,
      entity: "membership",
      entityId: membership._id,
      newValue: { role: "MEMBER", joinedVia: "slug" },
    });

    res.status(200).json({
      success: true,
      message: `Successfully joined ${org.name}`,
      data: {
        _id: org._id,
        name: org.name,
        slug: org.slug,
        role: "MEMBER",
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to join organization" });
  }
};
