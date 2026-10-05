import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireOrgMember } from "../middleware/orgMember.js";
import { requirePermission } from "../middleware/permissions.js";
import {
  createOrganization,
  getMyOrganizations,
  getOrgMembers,
  addMember,
  removeMember,
  updateMemberRole,
  joinOrganization,
} from "../controllers/organization.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/", createOrganization);
router.post("/join", joinOrganization);
router.get("/", getMyOrganizations);

// Member routes - require org membership
router.get("/:id/members", requireOrgMember, requirePermission("view"), getOrgMembers);
router.post(
  "/:id/members",
  requireOrgMember,
  requirePermission("manage_members"),
  addMember
);
router.delete(
  "/:id/members/:userId",
  requireOrgMember,
  requirePermission("manage_members"),
  removeMember
);
router.patch(
  "/:id/members/:userId",
  requireOrgMember,
  requirePermission("manage_members"),
  updateMemberRole
);

export default router;
