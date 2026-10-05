import { Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Notification } from "../models/notification.model.js";
import { Membership } from "../models/membership.model.js";

const querySchema = z.object({
  organizationId: z.string().min(1).optional(),
  read: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const q = parsed.data;
  const user = (req as any).user;

  try {
    const orgId = q.organizationId || (req.headers["x-organization-id"] as string);
    const filter: Record<string, unknown> = {
      userId: user._id,
    };
    if (orgId && mongoose.isValidObjectId(orgId)) {
      filter.organizationId = orgId;
    }
    if (q.read !== undefined) filter.read = q.read === "true";

    const skip = (q.page - 1) * q.limit;

    const unreadFilter: Record<string, unknown> = { userId: user._id, read: false };
    if (orgId && mongoose.isValidObjectId(orgId)) {
      unreadFilter.organizationId = orgId;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(q.limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments(unreadFilter),
    ]);

    res.json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: { page: q.page, limit: q.limit, total, hasMore: skip + notifications.length < total },
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
};

export const markNotificationRead = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: user._id },
      { read: true },
      { new: true }
    ).lean();

    if (!notification) {
      res.status(404).json({ success: false, message: "Notification not found" });
      return;
    }

    res.json({ success: true, data: notification });
  } catch {
    res.status(500).json({ success: false, message: "Failed to mark notification as read" });
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response): Promise<void> => {
  const orgId = (req.query.organizationId as string) || (req.headers["x-organization-id"] as string);
  const user = (req as any).user;

  try {
    const filter: Record<string, unknown> = { userId: user._id, read: false };
    if (orgId && mongoose.isValidObjectId(orgId)) {
      filter.organizationId = orgId;
    }

    await Notification.updateMany(filter, { read: true });
    res.json({ success: true, message: "All notifications marked as read" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to mark all as read" });
  }
};
