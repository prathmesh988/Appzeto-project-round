import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Membership } from "../models/membership.model.js";
import { Project } from "../models/project.model.js";
import { setSocketIO } from "../services/notification.service.js";

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return io;
}

export function initSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    },
  });

  // Set io on notification service for live push
  setSocketIO(io);

  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
      (socket as any).userId = decoded.userId;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId as string;
    console.log(`[Socket] User connected: ${userId}`);

    // Auto-join personal room
    socket.join(`user:${userId}`);

    // Join a project room (server verifies membership)
    socket.on("project:join", async (projectId: string) => {
      try {
        const project = await Project.findById(projectId).lean();
        if (!project) {
          socket.emit("error", { message: "Project not found" });
          return;
        }

        const membership = await Membership.findOne({
          userId,
          organizationId: project.organizationId,
        }).lean();

        if (!membership) {
          socket.emit("error", { message: "Access denied" });
          return;
        }

        socket.join(`project:${projectId}`);
        console.log(`[Socket] User ${userId} joined project:${projectId}`);
      } catch (err) {
        socket.emit("error", { message: "Failed to join project room" });
      }
    });

    socket.on("project:leave", (projectId: string) => {
      socket.leave(`project:${projectId}`);
      console.log(`[Socket] User ${userId} left project:${projectId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${userId}`);
    });
  });

  return io;
}
