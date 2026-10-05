import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
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
  console.log("🌱 Seeding demo data...\n");

  // Clean up existing demo data
  await User.deleteMany({ email: { $regex: /demo-/ } });
  await Organization.deleteMany({ slug: { $regex: /demo-/ } });

  const passwordHash = bcrypt.hashSync("Demo1234!", 12);

  // Create users
  const users = await User.insertMany([
    { name: "Alice Owner", email: "demo-alice@example.com", passwordHash },
    { name: "Bob Admin", email: "demo-bob@example.com", passwordHash },
    { name: "Carol Member", email: "demo-carol@example.com", passwordHash },
    { name: "Dave Viewer", email: "demo-dave@example.com", passwordHash },
    { name: "Eve Dual", email: "demo-eve@example.com", passwordHash }, // belongs to both orgs
    { name: "Frank Admin", email: "demo-frank@example.com", passwordHash },
  ]);

  // Create 2 organizations
  const org1 = await Organization.create({
    name: "Acme Corp",
    slug: "demo-acme",
    createdBy: users[0]._id,
  });
  const org2 = await Organization.create({
    name: "Globex Inc",
    slug: "demo-globex",
    createdBy: users[3]._id,
  });

  // Memberships for Org 1
  await Membership.insertMany([
    { userId: users[0]._id, organizationId: org1._id, role: "OWNER" },
    { userId: users[1]._id, organizationId: org1._id, role: "ADMIN" },
    { userId: users[2]._id, organizationId: org1._id, role: "MEMBER" },
    { userId: users[3]._id, organizationId: org1._id, role: "VIEWER" },
    { userId: users[4]._id, organizationId: org1._id, role: "MEMBER" }, // Eve in both
  ]);

  // Memberships for Org 2
  await Membership.insertMany([
    { userId: users[3]._id, organizationId: org2._id, role: "OWNER" },
    { userId: users[5]._id, organizationId: org2._id, role: "ADMIN" },
    { userId: users[4]._id, organizationId: org2._id, role: "MEMBER" }, // Eve in both
  ]);

  // Projects
  const project1 = await Project.create({
    organizationId: org1._id,
    name: "Website Redesign",
    description: "Redesign the company website",
    createdBy: users[0]._id,
  });
  const project2 = await Project.create({
    organizationId: org1._id,
    name: "Mobile App",
    description: "Build the mobile app",
    createdBy: users[1]._id,
  });
  const project3 = await Project.create({
    organizationId: org2._id,
    name: "API Integration",
    description: "Integrate third-party APIs",
    createdBy: users[3]._id,
  });
  const project4 = await Project.create({
    organizationId: org2._id,
    name: "Data Pipeline",
    description: "Build ETL data pipeline",
    createdBy: users[5]._id,
  });

  // Tasks (~30 with varied status/priority/labels/due dates)
  const statuses = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
  const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
  const labelSets = [
    ["frontend", "ui"],
    ["backend", "api"],
    ["bug", "urgent"],
    ["feature"],
    ["documentation"],
    ["testing", "qa"],
  ];

  const orgProjects = [
    { org: org1, projects: [project1, project2], users: [users[0], users[1], users[2]] },
    { org: org2, projects: [project3, project4], users: [users[3], users[5], users[4]] },
  ];

  let taskCount = 0;
  for (const { org, projects, users: orgUsers } of orgProjects) {
    for (const project of projects) {
      for (let i = 0; i < 8; i++) {
        const status = statuses[i % 4];
        const priority = priorities[i % 4];
        const daysOffset = Math.floor(Math.random() * 30) - 10;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + daysOffset);

        const task = await Task.create({
          organizationId: org._id,
          projectId: project._id,
          title: `Task ${taskCount + 1}: ${["Setup auth", "Build dashboard", "Write tests", "Fix bug", "Deploy to prod", "Code review", "Update docs", "Performance optimization"][i]}`,
          description: `This is the description for task ${taskCount + 1}. It contains details about what needs to be done.`,
          status,
          priority,
          assigneeId: orgUsers[i % orgUsers.length]._id,
          reporterId: orgUsers[0]._id,
          dueDate,
          labels: labelSets[i % labelSets.length],
          position: (i + 1) * 1000,
        });

        // Add a comment to some tasks
        if (i % 3 === 0) {
          await Comment.create({
            organizationId: org._id,
            taskId: task._id,
            authorId: orgUsers[1 % orgUsers.length]._id,
            body: `This is a comment on task ${taskCount + 1}. Great progress! @${orgUsers[0].email}`,
            mentions: [orgUsers[0]._id],
          });
        }

        // Audit log entries
        await AuditLog.create({
          userId: orgUsers[0]._id,
          organizationId: org._id,
          action: "TASK_CREATED",
          entity: "task",
          entityId: task._id,
          newValue: { title: task.title, status: task.status },
          timestamp: new Date(),
        });

        taskCount++;
      }
    }
  }

  // Notifications
  await Notification.insertMany([
    {
      userId: users[2]._id,
      organizationId: org1._id,
      type: "TASK_ASSIGNED",
      message: "You have been assigned to Task 3",
      read: false,
    },
    {
      userId: users[0]._id,
      organizationId: org1._id,
      type: "MENTION",
      message: "Bob Admin mentioned you in a comment",
      read: true,
    },
  ]);

  console.log("\n✅ Demo data seeded successfully!\n");
  console.log("📋 Demo Credentials (password: Demo1234! for all):");
  console.log("  alice:  demo-alice@example.com (OWNER of Acme Corp)");
  console.log("  bob:    demo-bob@example.com   (ADMIN of Acme Corp)");
  console.log("  carol:  demo-carol@example.com (MEMBER of Acme Corp)");
  console.log("  dave:   demo-dave@example.com  (VIEWER of Acme Corp, OWNER of Globex)");
  console.log("  eve:    demo-eve@example.com   (MEMBER of both orgs)");
  console.log("  frank:  demo-frank@example.com (ADMIN of Globex Inc)\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
