import { Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Task } from "../models/task.model.js";
import { Project } from "../models/project.model.js";
import { User } from "../models/user.model.js";
import { Membership } from "../models/membership.model.js";
import { auditService, AuditActions } from "../services/audit.service.js";
import { notificationService } from "../services/notification.service.js";
import { can } from "../middleware/permissions.js";
import { getIO } from "../sockets/socket.js";

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(500).trim(),
  description: z.string().max(10000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  labels: z.array(z.string()).default([]),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).trim().optional(),
  description: z.string().max(10000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  position: z.number().optional(),
});

const querySchema = z.object({
  organizationId: z.string().min(1).optional(),
  projectId: z.string().optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  priority: z.union([z.string(), z.array(z.string())]).optional(),
  assignee: z.string().optional(), // "me" or userId
  labels: z.union([z.string(), z.array(z.string())]).optional(),
  labelsMode: z.enum(["any", "all"]).default("any"),
  dueBefore: z.string().optional(),
  dueAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  createdAfter: z.string().optional(),
  q: z.string().optional(),
  sort: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createTask = async (req: Request, res: Response): Promise<void> => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const data = parsed.data;
  const user = (req as any).user;

  try {
    // Look up project and derive org (never trust body organizationId)
    const project = await Project.findById(data.projectId).lean();
    if (!project) {
      res.status(404).json({ success: false, message: "Project not found" });
      return;
    }

    // Verify membership
    const membership = await Membership.findOne({
      userId: user._id,
      organizationId: project.organizationId,
    }).lean();
    if (!membership) {
      res.status(404).json({ success: false, message: "Project not found" });
      return;
    }

    if (!can(membership.role, "create_task")) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }

    // Compute position: max position in TODO + gap
    const lastTask = await Task.findOne({
      projectId: data.projectId,
      organizationId: project.organizationId,
      status: "TODO",
    })
      .sort({ position: -1 })
      .select("position")
      .lean();

    const position = lastTask ? lastTask.position + 1000 : 1000;

    const task = await Task.create({
      organizationId: project.organizationId,
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      assigneeId: data.assigneeId || undefined,
      reporterId: user._id,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      labels: data.labels,
      position,
      status: "TODO",
    });

    await auditService.log({
      userId: user._id,
      organizationId: project.organizationId,
      action: AuditActions.TASK_CREATED,
      entity: "task",
      entityId: task._id,
      newValue: { title: data.title, status: "TODO", priority: data.priority },
    });

    // Notify assignee if different from creator
    if (data.assigneeId && data.assigneeId !== user._id.toString()) {
      await notificationService.create({
        userId: data.assigneeId,
        organizationId: project.organizationId,
        type: "TASK_ASSIGNED",
        taskId: task._id,
        message: `You have been assigned to "${data.title}"`,
      });
    }

    // Populate assignee & reporter for real-time frontend reflection
    let assigneeUser = null;
    if (data.assigneeId) {
      assigneeUser = await User.findById(data.assigneeId).select("name email avatarUrl").lean();
    }
    const reporterUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
    const taskPayload = {
      ...task.toObject(),
      assignee: assigneeUser,
      reporter: reporterUser,
    };

    // Emit socket event
    const io = getIO();
    if (io) {
      io.to(`project:${data.projectId}`).emit("task:created", {
        task: taskPayload,
        actorId: user._id.toString(),
      });
    }

    res.status(201).json({ success: true, data: taskPayload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create task" });
  }
};

export const getTasks = async (req: Request, res: Response): Promise<void> => {
  const queryResult = querySchema.safeParse(req.query);
  if (!queryResult.success) {
    res.status(400).json({ success: false, errors: queryResult.error.flatten().fieldErrors });
    return;
  }
  const q = queryResult.data;
  const user = (req as any).user;

  const orgId = q.organizationId || (req.headers["x-organization-id"] as string);
  if (!orgId) {
    res.status(400).json({ success: false, message: "Organization ID is required" });
    return;
  }

  // Verify membership for this org
  const membership = await Membership.findOne({
    userId: user._id,
    organizationId: orgId,
  }).lean();
  if (!membership) {
    res.status(404).json({ success: false, message: "Organization not found" });
    return;
  }

  try {
    // Build filter - never pass user input directly into mongo query
    const filter: Record<string, unknown> = { organizationId: orgId };

    if (q.projectId) filter.projectId = q.projectId;

    // Status - whitelist values
    const validStatuses = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];
    if (q.status) {
      const statuses = Array.isArray(q.status) ? q.status : [q.status];
      const filtered = statuses.filter((s) => validStatuses.includes(s));
      if (filtered.length) filter.status = { $in: filtered };
    }

    // Priority - whitelist values
    const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    if (q.priority) {
      const priorities = Array.isArray(q.priority) ? q.priority : [q.priority];
      const filtered = priorities.filter((p) => validPriorities.includes(p));
      if (filtered.length) filter.priority = { $in: filtered };
    }

    // Assignee
    if (q.assignee) {
      const assigneeId = q.assignee === "me" ? user._id.toString() : q.assignee;
      if (mongoose.isValidObjectId(assigneeId)) {
        filter.assigneeId = new mongoose.Types.ObjectId(assigneeId);
      }
    }

    // Labels
    if (q.labels) {
      const labels = Array.isArray(q.labels) ? q.labels : [q.labels];
      if (q.labelsMode === "all") {
        filter.labels = { $all: labels };
      } else {
        filter.labels = { $in: labels };
      }
    }

    // Date ranges
    const dueDateFilter: Record<string, Date> = {};
    if (q.dueBefore) dueDateFilter.$lt = new Date(q.dueBefore);
    if (q.dueAfter) dueDateFilter.$gt = new Date(q.dueAfter);
    if (Object.keys(dueDateFilter).length) filter.dueDate = dueDateFilter;

    const createdAtFilter: Record<string, Date> = {};
    if (q.createdBefore) createdAtFilter.$lt = new Date(q.createdBefore);
    if (q.createdAfter) createdAtFilter.$gt = new Date(q.createdAfter);
    if (Object.keys(createdAtFilter).length) filter.createdAt = createdAtFilter;

    // Text search
    if (q.q) {
      filter.$text = { $search: q.q };
    }

    // Sort - whitelist
    const validSorts: Record<string, Record<string, number>> = {
      createdAt: { createdAt: -1 },
      dueDate: { dueDate: 1 },
      priority: { priority: -1 },
      position: { position: 1 },
    };
    const sort = q.sort && validSorts[q.sort] ? validSorts[q.sort] : { createdAt: -1 };

    const skip = (q.page - 1) * q.limit;

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .sort(sort as any)
        .skip(skip)
        .limit(q.limit)
        .select("-description -attachments") // list responses exclude heavy fields
        .lean(),
      Task.countDocuments(filter),
    ]);

    // Batch-fetch assignees and reporters
    const userIds = [
      ...new Set([
        ...tasks.map((t) => t.assigneeId?.toString()).filter(Boolean),
        ...tasks.map((t) => t.reporterId?.toString()).filter(Boolean),
      ]),
    ] as string[];

    const users = await User.find({ _id: { $in: userIds } })
      .select("name email avatarUrl")
      .lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const enriched = tasks.map((t) => ({
      ...t,
      assignee: t.assigneeId ? userMap.get(t.assigneeId.toString()) : null,
      reporter: userMap.get(t.reporterId.toString()),
    }));

    res.json({
      success: true,
      data: enriched,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        hasMore: skip + tasks.length < total,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch tasks" });
  }
};

export const getTask = async (req: Request, res: Response): Promise<void> => {
  const { id: taskId } = req.params;
  const user = (req as any).user;

  try {
    const task = await Task.findById(taskId).lean();
    if (!task) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    // Verify org membership
    const membership = await Membership.findOne({
      userId: user._id,
      organizationId: task.organizationId,
    }).lean();
    if (!membership) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    // Batch-fetch related users
    const userIds = [task.assigneeId?.toString(), task.reporterId?.toString()].filter(
      Boolean
    ) as string[];
    const users = await User.find({ _id: { $in: userIds } })
      .select("name email avatarUrl")
      .lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    res.json({
      success: true,
      data: {
        ...task,
        assignee: task.assigneeId ? userMap.get(task.assigneeId.toString()) : null,
        reporter: userMap.get(task.reporterId.toString()),
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch task" });
  }
};

export const updateTask = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const updates = parsed.data;
  const { id: taskId } = req.params;
  const user = (req as any).user;

  try {
    const task = await Task.findById(taskId);
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

    const allowed = can(membership.role, "edit_task", {
      assigneeId: task.assigneeId?.toString(),
      actorId: user._id.toString(),
    });
    if (!allowed) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }

    // MEMBER cannot change assigneeId
    if (membership.role === "MEMBER" && updates.assigneeId !== undefined) {
      res.status(403).json({ success: false, message: "MEMBER cannot change assignee" });
      return;
    }

    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    // Apply changes with diff tracking
    if (updates.title !== undefined && updates.title !== task.title) {
      oldValues.title = task.title;
      newValues.title = updates.title;
      task.title = updates.title;
    }
    if (updates.description !== undefined && updates.description !== task.description) {
      oldValues.description = task.description;
      newValues.description = updates.description;
      task.description = updates.description;
    }

    let statusChanged = false;
    if (updates.status !== undefined && updates.status !== task.status) {
      oldValues.status = task.status;
      newValues.status = updates.status;
      task.status = updates.status;
      statusChanged = true;
    }

    let priorityChanged = false;
    if (updates.priority !== undefined && updates.priority !== task.priority) {
      oldValues.priority = task.priority;
      newValues.priority = updates.priority;
      task.priority = updates.priority;
      priorityChanged = true;
    }

    let assigneeChanged = false;
    const oldAssigneeId = task.assigneeId?.toString();
    if (
      updates.assigneeId !== undefined &&
      (updates.assigneeId || null) !== (task.assigneeId?.toString() || null)
    ) {
      oldValues.assigneeId = task.assigneeId?.toString();
      newValues.assigneeId = updates.assigneeId || null;
      task.assigneeId = updates.assigneeId
        ? new mongoose.Types.ObjectId(updates.assigneeId)
        : undefined;
      assigneeChanged = true;
    }

    if (updates.dueDate !== undefined) {
      const newDueDate = updates.dueDate ? new Date(updates.dueDate) : undefined;
      oldValues.dueDate = task.dueDate;
      newValues.dueDate = newDueDate;
      task.dueDate = newDueDate;
    }

    if (updates.labels !== undefined) {
      oldValues.labels = task.labels;
      newValues.labels = updates.labels;
      task.labels = updates.labels;
    }

    let positionChanged = false;
    if (updates.position !== undefined && updates.position !== task.position) {
      oldValues.position = task.position;
      newValues.position = updates.position;
      task.position = updates.position;
      positionChanged = true;

      // Check if gaps are too small and rebalance
      await rebalanceIfNeeded(task.projectId.toString(), task.organizationId.toString(), task.status);
    }

    await task.save();

    // Audit logging
    if (statusChanged) {
      await auditService.log({
        userId: user._id,
        organizationId: task.organizationId,
        action: AuditActions.TASK_STATUS_CHANGED,
        entity: "task",
        entityId: task._id,
        oldValue: { status: oldValues.status },
        newValue: { status: newValues.status },
      });
    }
    if (priorityChanged) {
      await auditService.log({
        userId: user._id,
        organizationId: task.organizationId,
        action: AuditActions.TASK_PRIORITY_CHANGED,
        entity: "task",
        entityId: task._id,
        oldValue: { priority: oldValues.priority },
        newValue: { priority: newValues.priority },
      });
    }
    if (assigneeChanged) {
      await auditService.log({
        userId: user._id,
        organizationId: task.organizationId,
        action: AuditActions.TASK_ASSIGNEE_CHANGED,
        entity: "task",
        entityId: task._id,
        oldValue: { assigneeId: oldValues.assigneeId },
        newValue: { assigneeId: newValues.assigneeId },
      });
    }
    if (Object.keys(newValues).length > 0 && !statusChanged && !priorityChanged && !assigneeChanged) {
      await auditService.log({
        userId: user._id,
        organizationId: task.organizationId,
        action: AuditActions.TASK_UPDATED,
        entity: "task",
        entityId: task._id,
        oldValue: oldValues,
        newValue: newValues,
      });
    }

    // Notifications
    const newAssigneeId = task.assigneeId?.toString();
    if (assigneeChanged && newAssigneeId && newAssigneeId !== user._id.toString()) {
      await notificationService.create({
        userId: newAssigneeId,
        organizationId: task.organizationId,
        type: "TASK_ASSIGNED",
        taskId: task._id,
        message: `You have been assigned to "${task.title}"`,
      });
    }

    if (statusChanged) {
      const toNotify = [task.assigneeId?.toString(), task.reporterId?.toString()]
        .filter(Boolean)
        .filter((id) => id !== user._id.toString()) as string[];

      for (const uid of toNotify) {
        await notificationService.create({
          userId: uid,
          organizationId: task.organizationId,
          type: "STATUS_CHANGED",
          taskId: task._id,
          message: `Task "${task.title}" status changed to ${task.status}`,
        });
      }
    }

    // Emit socket events
    const io = getIO();
    let assigneeUser = null;
    if (task.assigneeId) {
      assigneeUser = await User.findById(task.assigneeId).select("name email avatarUrl").lean();
    }
    const taskPayload = {
      ...task.toObject(),
      assignee: assigneeUser,
    };

    if (io) {
      const eventName = positionChanged || statusChanged ? "task:moved" : "task:updated";
      io.to(`project:${task.projectId}`).emit(eventName, {
        task: taskPayload,
        actorId: user._id.toString(),
        changes: newValues,
      });
    }

    res.json({ success: true, data: taskPayload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to update task" });
  }
};

export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  const { id: taskId } = req.params;
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

    if (!can(membership.role, "delete_task")) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }

    await Task.deleteOne({ _id: taskId });

    await auditService.log({
      userId: user._id,
      organizationId: task.organizationId,
      action: AuditActions.TASK_DELETED,
      entity: "task",
      entityId: task._id,
      oldValue: { title: task.title, status: task.status },
    });

    const io = getIO();
    if (io) {
      io.to(`project:${task.projectId}`).emit("task:deleted", {
        taskId,
        actorId: user._id.toString(),
      });
    }

    res.json({ success: true, message: "Task deleted" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to delete task" });
  }
};

// Rebalance positions when gaps get too small (< 1)
async function rebalanceIfNeeded(
  projectId: string,
  organizationId: string,
  status: string
): Promise<void> {
  const tasks = await Task.find({ projectId, organizationId, status } as any)
    .sort({ position: 1 })
    .select("_id position")
    .lean();

  const hasSmallGap = tasks.some((t, i) => {
    if (i === 0) return false;
    return t.position - tasks[i - 1].position < 1;
  });

  if (hasSmallGap) {
    const bulkOps = tasks.map((t, i) => ({
      updateOne: {
        filter: { _id: t._id },
        update: { $set: { position: (i + 1) * 1000 } },
      },
    }));
    await Task.bulkWrite(bulkOps);
  }
}

export const addAttachment = async (req: Request, res: Response): Promise<void> => {
  const taskId = req.params.id as string;
  const user = (req as any).user;
  const file = req.file;

  if (!file) {
    res.status(400).json({ success: false, message: "No file provided" });
    return;
  }

  try {
    const task = await Task.findById(taskId);
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

    if (!can(membership.role, "edit_task", { assigneeId: task.assigneeId?.toString(), actorId: user._id.toString() })) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }

    const attachment = {
      filename: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      uploadedBy: user._id,
      uploadedAt: new Date(),
    };

    task.attachments.push(attachment as any);
    await task.save();

    await auditService.log({
      userId: user._id,
      organizationId: task.organizationId,
      action: AuditActions.ATTACHMENT_ADDED,
      entity: "task",
      entityId: task._id,
      newValue: { filename: file.originalname, size: file.size },
    });

    const io = getIO();
    if (io) {
      io.to(`project:${task.projectId}`).emit("task:updated", {
        taskId: task._id,
        actorId: user._id.toString(),
        changes: { attachmentsCount: task.attachments.length },
      });
    }

    res.json({ success: true, data: attachment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to upload attachment" });
  }
};
