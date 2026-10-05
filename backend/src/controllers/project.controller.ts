import { Request, Response } from "express";
import { z } from "zod";
import { Project } from "../models/project.model.js";
import { auditService, AuditActions } from "../services/audit.service.js";

const createProjectSchema = z.object({
  organizationId: z.string().min(1).optional(),
  name: z.string().min(2).max(100).trim(),
  description: z.string().max(2000).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  description: z.string().max(2000).optional(),
  archived: z.boolean().optional(),
});

export const createProject = async (req: Request, res: Response): Promise<void> => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { name, description } = parsed.data;
  const user = (req as any).user;

  const orgId =
    parsed.data.organizationId ||
    (req as any).organizationId ||
    (req as any).membership?.organizationId?.toString();

  if (!orgId) {
    res.status(400).json({ success: false, message: "Organization ID is required" });
    return;
  }

  // Verify the membership covers this org
  const membership = (req as any).membership;
  if (membership && membership.organizationId.toString() !== orgId.toString()) {
    res.status(404).json({ success: false, message: "Organization not found" });
    return;
  }

  try {
    const project = await Project.create({
      organizationId: orgId,
      name,
      description,
      createdBy: user._id,
    });

    await auditService.log({
      userId: user._id,
      organizationId: orgId,
      action: AuditActions.PROJECT_CREATED,
      entity: "project",
      entityId: project._id,
      newValue: { name, description },
    });

    res.status(201).json({ success: true, data: project });
  } catch {
    res.status(500).json({ success: false, message: "Failed to create project" });
  }
};

export const getProjects = async (req: Request, res: Response): Promise<void> => {
  const orgId = (req as any).organizationId;
  const includeArchived = req.query.includeArchived === "true";

  try {
    const filter: Record<string, unknown> = { organizationId: orgId };
    if (!includeArchived) filter.archived = false;

    const projects = await Project.find(filter)
      .select("name description archived createdBy createdAt updatedAt organizationId")
      .lean();

    res.json({ success: true, data: projects });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch projects" });
  }
};

export const getProject = async (req: Request, res: Response): Promise<void> => {
  const membership = (req as any).membership;
  const project = (req as any).project;

  // project loaded in middleware/route
  if (!project) {
    res.status(404).json({ success: false, message: "Project not found" });
    return;
  }

  res.json({ success: true, data: project });
};

export const updateProject = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const { id: projectId } = req.params;
  const user = (req as any).user;
  const membership = (req as any).membership;

  try {
    const project = await Project.findOne({
      _id: projectId,
      organizationId: membership.organizationId,
    });
    if (!project) {
      res.status(404).json({ success: false, message: "Project not found" });
      return;
    }

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    if (parsed.data.name !== undefined && parsed.data.name !== project.name) {
      oldValue.name = project.name;
      newValue.name = parsed.data.name;
      project.name = parsed.data.name;
    }
    if (parsed.data.description !== undefined && parsed.data.description !== project.description) {
      oldValue.description = project.description;
      newValue.description = parsed.data.description;
      project.description = parsed.data.description;
    }
    if (parsed.data.archived !== undefined && parsed.data.archived !== project.archived) {
      oldValue.archived = project.archived;
      newValue.archived = parsed.data.archived;
      project.archived = parsed.data.archived;
    }

    await project.save();

    if (Object.keys(newValue).length > 0) {
      await auditService.log({
        userId: user._id,
        organizationId: membership.organizationId,
        action: AuditActions.PROJECT_UPDATED,
        entity: "project",
        entityId: project._id,
        oldValue,
        newValue,
      });
    }

    res.json({ success: true, data: project });
  } catch {
    res.status(500).json({ success: false, message: "Failed to update project" });
  }
};
