import { Request, Response } from "express";
import { z } from "zod";
import { AuditLog } from "../models/auditlog.model.js";
import { User } from "../models/user.model.js";
import { Membership } from "../models/membership.model.js";
import { can } from "../middleware/permissions.js";

const querySchema = z.object({
  organizationId: z.string().min(1),
  action: z.string().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const q = parsed.data;
  const user = (req as any).user;

  try {
    // Verify ADMIN+ membership
    const membership = await Membership.findOne({
      userId: user._id,
      organizationId: q.organizationId,
    }).lean();
    if (!membership) {
      res.status(404).json({ success: false, message: "Organization not found" });
      return;
    }

    if (!can(membership.role, "view_audit_logs")) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }

    const filter: Record<string, unknown> = { organizationId: q.organizationId };

    if (q.action) filter.action = q.action;
    if (q.entity) filter.entity = q.entity;
    if (q.entityId) filter.entityId = q.entityId;
    if (q.userId) filter.userId = q.userId;

    const timestampFilter: Record<string, Date> = {};
    if (q.from) timestampFilter.$gte = new Date(q.from);
    if (q.to) timestampFilter.$lte = new Date(q.to);
    if (Object.keys(timestampFilter).length) filter.timestamp = timestampFilter;

    const skip = (q.page - 1) * q.limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(q.limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    // Batch-fetch user info
    const userIds = [...new Set(logs.map((l) => l.userId.toString()))];
    const users = await User.find({ _id: { $in: userIds } })
      .select("name email avatarUrl")
      .lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const enriched = logs.map((l) => ({
      ...l,
      user: userMap.get(l.userId.toString()),
    }));

    res.json({
      success: true,
      data: enriched,
      pagination: { page: q.page, limit: q.limit, total, hasMore: skip + logs.length < total },
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch audit logs" });
  }
};
