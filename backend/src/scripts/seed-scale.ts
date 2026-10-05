import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model.js";
import { Organization } from "../models/organization.model.js";
import { Membership } from "../models/membership.model.js";
import { Project } from "../models/project.model.js";
import { Task } from "../models/task.model.js";

const MONGO_URI = process.env.MONGO_URI!;

const USERS_COUNT = 10000;
const ORGS_COUNT = 1000;
const TASKS_COUNT = 100000;
const BATCH_SIZE = 5000;

async function main() {
  console.log("🔌 Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected\n");
  console.log("⚠️  WARNING: This will generate 100k tasks, 10k users, 1k orgs.");
  console.log("   This may take several minutes...\n");

  const passwordHash = bcrypt.hashSync("Scale1234!", 10);

  // Create organizations in batches
  console.log("📦 Creating organizations...");
  const orgDocs = [];
  const creatorId = new mongoose.Types.ObjectId();
  for (let i = 0; i < ORGS_COUNT; i++) {
    orgDocs.push({ name: `Scale Org ${i}`, slug: `scale-org-${i}`, createdBy: creatorId });
  }
  const orgs = await Organization.insertMany(orgDocs, { ordered: false });
  console.log(`✅ Created ${orgs.length} organizations\n`);

  // Create users in batches
  console.log("👥 Creating users...");
  let userInserted = 0;
  const userIdPool: mongoose.Types.ObjectId[] = [];
  for (let batch = 0; batch < Math.ceil(USERS_COUNT / BATCH_SIZE); batch++) {
    const start = batch * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, USERS_COUNT);
    const userDocs = [];
    for (let i = start; i < end; i++) {
      const id = new mongoose.Types.ObjectId();
      userIdPool.push(id);
      userDocs.push({
        _id: id,
        name: `Scale User ${i}`,
        email: `scale-user-${i}@scale.test`,
        passwordHash,
      });
    }
    await User.insertMany(userDocs, { ordered: false });
    userInserted += userDocs.length;
    process.stdout.write(`  Users: ${userInserted}/${USERS_COUNT}\r`);
  }
  console.log(`\n✅ Created ${userInserted} users\n`);

  // Create projects - 2 per org
  console.log("📁 Creating projects...");
  const projectDocs = [];
  for (let i = 0; i < orgs.length; i++) {
    for (let j = 0; j < 2; j++) {
      projectDocs.push({
        organizationId: orgs[i]._id,
        name: `Scale Project ${i}-${j}`,
        createdBy: userIdPool[i % userIdPool.length],
        archived: false,
      });
    }
  }
  const projects = await Project.insertMany(projectDocs, { ordered: false });
  console.log(`✅ Created ${projects.length} projects\n`);

  // Create tasks in batches
  console.log("📋 Creating 100k tasks...");
  const statuses = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
  const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
  let taskInserted = 0;

  for (let batch = 0; batch < Math.ceil(TASKS_COUNT / BATCH_SIZE); batch++) {
    const start = batch * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, TASKS_COUNT);
    const taskDocs = [];

    for (let i = start; i < end; i++) {
      const project = projects[i % projects.length];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (i % 60) - 30);

      taskDocs.push({
        organizationId: project.organizationId,
        projectId: project._id,
        title: `Scale Task ${i}`,
        description: `Auto-generated task ${i} for performance testing`,
        status: statuses[i % 4],
        priority: priorities[i % 4],
        assigneeId: userIdPool[i % userIdPool.length],
        reporterId: userIdPool[(i + 1) % userIdPool.length],
        dueDate,
        labels: [`label-${i % 10}`],
        position: (i % 1000) * 1000,
      });
    }

    await Task.insertMany(taskDocs, { ordered: false });
    taskInserted += taskDocs.length;
    process.stdout.write(`  Tasks: ${taskInserted}/${TASKS_COUNT}\r`);
  }
  console.log(`\n✅ Created ${taskInserted} tasks\n`);

  // Run explain() calls to verify index usage
  console.log("🔍 Running explain() calls to verify index usage...\n");

  const sampleOrgId = orgs[0]._id;
  const sampleProjectId = projects[0]._id;

  // Test 1: Board load query
  const explain1 = await Task.find({
    organizationId: sampleOrgId,
    projectId: sampleProjectId,
    status: "TODO",
  })
    .sort({ position: 1 })
    .limit(50)
    .explain("executionStats");

  const stats1 = (explain1 as any).executionStats;
  console.log("📊 Test 1: Board load (org + project + status + position)");
  console.log(`   Stage: ${(explain1 as any).queryPlanner?.winningPlan?.inputStage?.stage || "N/A"}`);
  console.log(`   totalDocsExamined: ${stats1.totalDocsExamined}`);
  console.log(`   totalKeysExamined: ${stats1.totalKeysExamined}`);
  console.log(`   executionTimeMillis: ${stats1.executionTimeMillis}ms\n`);

  // Test 2: My tasks query
  const sampleUserId = userIdPool[0];
  const explain2 = await Task.find({
    organizationId: sampleOrgId,
    assigneeId: sampleUserId,
    status: "IN_PROGRESS",
  }).explain("executionStats");

  const stats2 = (explain2 as any).executionStats;
  console.log("📊 Test 2: My tasks (org + assignee + status)");
  console.log(`   totalDocsExamined: ${stats2.totalDocsExamined}`);
  console.log(`   totalKeysExamined: ${stats2.totalKeysExamined}`);
  console.log(`   executionTimeMillis: ${stats2.executionTimeMillis}ms\n`);

  // Test 3: Combined filter query
  const explain3 = await Task.find({
    organizationId: sampleOrgId,
    status: "TODO",
    priority: "HIGH",
    dueDate: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  }).explain("executionStats");

  const stats3 = (explain3 as any).executionStats;
  console.log("📊 Test 3: Combined filters (org + status + priority + dueDate)");
  console.log(`   totalDocsExamined: ${stats3.totalDocsExamined}`);
  console.log(`   totalKeysExamined: ${stats3.totalKeysExamined}`);
  console.log(`   executionTimeMillis: ${stats3.executionTimeMillis}ms\n`);

  console.log("✅ Scale seed complete. Paste the explain() results into the README.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Scale seed failed:", err);
  process.exit(1);
});
