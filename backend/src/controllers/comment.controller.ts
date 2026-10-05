import { Request, Response } from "express";
import { z } from "zod";
import { Comment } from "../models/comment.model.js";
import { Task } from "../models/task.model.js";
import { User } from "../models/user.model.js";
import { Membership } from "../models/membership.model.js";
import { auditService, AuditActions } from "../services/audit.service.js";
import { notificationService } from "../services/notification.service.js";
import { can } from "../middleware/permissions.js";
import { getIO } from "../sockets/socket.js";

const createCommentSchema = z.object({
  body: z.string().min(1).max(10000).trim(),
  // @email mention syntax - parsed from body
});

// Parse @email mentions from comment body
function parseMentions(body: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const matches = body.match(mentionRegex) || [];
  return matches.map((m) => m.slice(1)); // Remove the @ prefix
}

export const createComment = async (req: Request, res: Response): Promise<void> => {
  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { body } = parsed.data;
  const taskId = req.params.id as string;
  const user = (req as any).user;

  try {
    const task = await Task.findById(taskId).lean();
    if (!task) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    const membership = await Membership.findOne({
      userId: user._id,
      organizationId: task.organizationId,
    }).lean();
    if (!membership) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    if (!can(membership.role, "comment")) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }

    // Parse mentions and resolve to user IDs (only org members)
    const mentionedEmails = parseMentions(body);
    let mentionIds: string[] = [];

    if (mentionedEmails.length > 0) {
      const mentionedUsers = await User.find({ email: { $in: mentionedEmails } })
        .select("_id email")
        .lean();

      // Verify mentioned users are org members
      const memberUserIds = await Membership.find({
        organizationId: task.organizationId,
        userId: { $in: mentionedUsers.map((u) => u._id) },
      })
        .select("userId")
        .lean();

      const validMemberIds = new Set(memberUserIds.map((m) => m.userId.toString()));
      mentionIds = mentionedUsers
        .filter((u) => validMemberIds.has(u._id.toString()))
        .map((u) => u._id.toString());
    }

    const comment = (await Comment.create({
      organizationId: task.organizationId,
      taskId,
      authorId: user._id,
      body,
      mentions: mentionIds,
    })) as any;

    await auditService.log({
      userId: user._id,
      organizationId: task.organizationId,
      action: AuditActions.COMMENT_ADDED,
      entity: "comment",
      entityId: comment._id,
      newValue: { taskId, body: body.substring(0, 200) },
    });

    // Notify mentioned users
    for (const mentionedId of mentionIds) {
      if (mentionedId !== user._id.toString()) {
        await notificationService.create({
          userId: mentionedId,
          organizationId: task.organizationId,
          type: "MENTION",
          taskId: task._id,
          message: `${user.name} mentioned you in a comment on "${task.title}"`,
        });
      }
    }

    const io = getIO();
    if (io) {
      io.to(`project:${task.projectId}`).emit("comment:created", {
        comment: { ...comment.toObject(), author: { name: user.name, avatarUrl: user.avatarUrl } },
        actorId: user._id.toString(),
      });
    }

    res.status(201).json({ success: true, data: comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create comment" });
  }
};

export const getComments = async (req: Request, res: Response): Promise<void> => {
  const taskId = req.params.id as string;
  const user = (req as any).user;

  try {
    const task = await Task.findById(taskId).lean();
    if (!task) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    const membership = await Membership.findOne({
      userId: user._id,
      organizationId: task.organizationId,
    }).lean();
    if (!membership) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    const comments = await Comment.find({ taskId })
      .sort({ createdAt: 1 })
      .lean();

    // Batch-fetch authors
    const authorIds = [...new Set(comments.map((c) => c.authorId.toString()))];
    const authors = await User.find({ _id: { $in: authorIds } })
      .select("name email avatarUrl")
      .lean();
    const authorMap = new Map(authors.map((a) => [a._id.toString(), a]));

    const enriched = comments.map((c) => ({
      ...c,
      author: authorMap.get(c.authorId.toString()),
    }));

    res.json({ success: true, data: enriched });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch comments" });
  }
};
