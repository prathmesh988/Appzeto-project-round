import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createTask,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
  addAttachment,
} from "../controllers/task.controller.js";
import { createComment, getComments } from "../controllers/comment.controller.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.use(requireAuth);

router.post("/", createTask);
router.get("/", getTasks);
router.get("/:id", getTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

// Attachments
router.post("/:id/attachments", upload.single("file"), addAttachment);

// Comments
router.post("/:id/comments", createComment);
router.get("/:id/comments", getComments);

export default router;
