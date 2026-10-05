import cron from "node-cron";
import { Task } from "../models/task.model.js";
import { notificationService } from "../services/notification.service.js";

/**
 * Runs every 15 minutes. Finds tasks not DONE with dueDate within next 24h.
 * Creates ONE notification per (task, assignee, due-date window) using dedupeKey.
 * Uses {status, dueDate} index for cross-org query.
 */
export function startDeadlineJob(): void {
  cron.schedule("*/15 * * * *", async () => {
    console.log("[DeadlineJob] Running deadline notification check...");

    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Dedupe window: round to nearest 15-minute slot
      const windowSlot = Math.floor(now.getTime() / (15 * 60 * 1000));

      // Process in batches of 500
      let skip = 0;
      const batchSize = 500;

      while (true) {
        const tasks = await Task.find({
          status: { $ne: "DONE" },
          dueDate: { $gte: now, $lte: in24h },
          assigneeId: { $exists: true, $ne: null },
        })
          .select("_id title organizationId assigneeId dueDate")
          .skip(skip)
          .limit(batchSize)
          .lean();

        if (tasks.length === 0) break;

        for (const task of tasks) {
          if (!task.assigneeId) continue;

          const dedupeKey = `deadline:${task._id}:${task.assigneeId}:${windowSlot}`;

          await notificationService.create({
            userId: task.assigneeId,
            organizationId: task.organizationId,
            type: "DEADLINE_APPROACHING",
            taskId: task._id,
            message: `Task "${task.title}" is due within 24 hours`,
            dedupeKey,
          });
        }

        if (tasks.length < batchSize) break;
        skip += batchSize;
      }

      console.log("[DeadlineJob] Done.");
    } catch (err) {
      console.error("[DeadlineJob] Error:", err);
    }
  });

  console.log("[DeadlineJob] Scheduled (every 15 minutes)");
}
