import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { initSocket } from "./sockets/socket.js";
import { startDeadlineJob } from "./jobs/deadlineJob.js";
import { env } from "./config/env.js";

const PORT = env.PORT;

const startServer = async () => {
  await connectDB();

  const httpServer = http.createServer(app);

  // Initialize Socket.IO
  initSocket(httpServer);

  // Start deadline cron job
  startDeadlineJob();

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌐 CORS origin: ${env.CLIENT_ORIGIN}`);
  });
};

startServer();
