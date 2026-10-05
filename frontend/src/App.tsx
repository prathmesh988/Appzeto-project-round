import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { ProjectsPage } from "@/pages/projects/ProjectsPage";
import { ProjectBoardPage } from "@/pages/projects/ProjectBoardPage";
import { TasksPage } from "@/pages/tasks/TasksPage";
import { MembersPage } from "@/pages/members/MembersPage";
import { AuditLogsPage } from "@/pages/audit-logs/AuditLogsPage";
import { NotificationsPage } from "@/pages/notifications/NotificationsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Authenticated workspace routes */}
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="board" element={<ProjectBoardPage />} />
          <Route path="board/:id" element={<ProjectBoardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectBoardPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="bottom-right" richColors />
    </BrowserRouter>
  );
}