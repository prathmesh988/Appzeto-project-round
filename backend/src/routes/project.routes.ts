import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireOrgMember, requireOrgMemberFromProject } from "../middleware/orgMember.js";
import { requirePermission } from "../middleware/permissions.js";
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
} from "../controllers/project.controller.js";
import { Project } from "../models/project.model.js";

const router = Router();

router.use(requireAuth);

// Load project and attach to req, verify org membership
async function loadProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await Project.findById(req.params.id).lean();
    if (!project) {
      res.status(404).json({ success: false, message: "Project not found" });
      return;
    }
    (req as any).project = project;
    // Set orgId for requireOrgMember to use
    req.headers["x-organization-id"] = project.organizationId.toString();
    next();
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
}

router.post("/", requireOrgMember, requirePermission("create_project"), createProject);
router.get("/", requireOrgMember, requirePermission("view"), getProjects);
router.get("/:id", loadProject, requireOrgMemberFromProject, requirePermission("view"), getProject);
router.put("/:id", loadProject, requireOrgMemberFromProject, requirePermission("edit_project"), updateProject);
router.patch("/:id", loadProject, requireOrgMemberFromProject, requirePermission("archive_project"), updateProject);

export default router;
