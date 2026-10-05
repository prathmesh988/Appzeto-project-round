import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Organization } from "../models/organization.model.js";
import { Membership } from "../models/membership.model.js";
import { Project } from "../models/project.model.js";
import { Task } from "../models/task.model.js";
import { Comment } from "../models/comment.model.js";
import { AuditLog } from "../models/auditlog.model.js";
import { Notification } from "../models/notification.model.js";

const MONGO_URI = process.env.MONGO_URI!;

async function main() {
  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected\n");

  const collections = [User, Organization, Membership, Project, Task, Comment, AuditLog, Notification];
  const names = ["users", "organizations", "memberships", "projects", "tasks", "comments", "auditlogs", "notifications"];

  for (let i = 0; i < collections.length; i++) {
    const model = collections[i];
    try {
      await model.createCollection();
      console.log(`✅ Collection created/verified: ${names[i]}`);
    } catch (err: any) {
      if (err.code === 48) {
        console.log(`ℹ️  Collection already exists: ${names[i]}`);
      } else {
        throw err;
      }
    }

    try {
      await model.syncIndexes();
      console.log(`   📑 Indexes synced for: ${names[i]}`);
    } catch (err) {
      console.error(`   ❌ Index sync failed for ${names[i]}:`, err);
    }
  }

  console.log("\n✅ db:init complete. All collections and indexes are ready.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ db:init failed:", err);
  process.exit(1);
});
