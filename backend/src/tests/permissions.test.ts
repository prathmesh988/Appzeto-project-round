import { describe, it, expect } from "vitest";
import { can } from "../middleware/permissions.js";

describe("Permission Matrix", () => {
  describe("view action", () => {
    it("VIEWER can view", () => expect(can("VIEWER", "view")).toBe(true));
    it("MEMBER can view", () => expect(can("MEMBER", "view")).toBe(true));
    it("ADMIN can view", () => expect(can("ADMIN", "view")).toBe(true));
    it("OWNER can view", () => expect(can("OWNER", "view")).toBe(true));
  });

  describe("create_task action", () => {
    it("VIEWER cannot create task", () => expect(can("VIEWER", "create_task")).toBe(false));
    it("MEMBER can create task", () => expect(can("MEMBER", "create_task")).toBe(true));
    it("ADMIN can create task", () => expect(can("ADMIN", "create_task")).toBe(true));
    it("OWNER can create task", () => expect(can("OWNER", "create_task")).toBe(true));
  });

  describe("edit_task action", () => {
    it("VIEWER cannot edit task", () => expect(can("VIEWER", "edit_task")).toBe(false));
    it("MEMBER cannot edit task not assigned to them", () =>
      expect(can("MEMBER", "edit_task", { assigneeId: "other-user", actorId: "actor" })).toBe(false));
    it("MEMBER can edit task assigned to them", () =>
      expect(can("MEMBER", "edit_task", { assigneeId: "user-1", actorId: "user-1" })).toBe(true));
    it("ADMIN can edit any task", () => expect(can("ADMIN", "edit_task")).toBe(true));
    it("OWNER can edit any task", () => expect(can("OWNER", "edit_task")).toBe(true));
  });

  describe("delete_task action", () => {
    it("VIEWER cannot delete task", () => expect(can("VIEWER", "delete_task")).toBe(false));
    it("MEMBER cannot delete task", () => expect(can("MEMBER", "delete_task")).toBe(false));
    it("ADMIN can delete task", () => expect(can("ADMIN", "delete_task")).toBe(true));
    it("OWNER can delete task", () => expect(can("OWNER", "delete_task")).toBe(true));
  });

  describe("comment action", () => {
    it("VIEWER cannot comment", () => expect(can("VIEWER", "comment")).toBe(false));
    it("MEMBER can comment", () => expect(can("MEMBER", "comment")).toBe(true));
    it("ADMIN can comment", () => expect(can("ADMIN", "comment")).toBe(true));
    it("OWNER can comment", () => expect(can("OWNER", "comment")).toBe(true));
  });

  describe("create_project action", () => {
    it("VIEWER cannot create project", () => expect(can("VIEWER", "create_project")).toBe(false));
    it("MEMBER cannot create project", () => expect(can("MEMBER", "create_project")).toBe(false));
    it("ADMIN can create project", () => expect(can("ADMIN", "create_project")).toBe(true));
    it("OWNER can create project", () => expect(can("OWNER", "create_project")).toBe(true));
  });

  describe("manage_members action", () => {
    it("VIEWER cannot manage members", () => expect(can("VIEWER", "manage_members")).toBe(false));
    it("MEMBER cannot manage members", () => expect(can("MEMBER", "manage_members")).toBe(false));
    it("ADMIN can manage members", () => expect(can("ADMIN", "manage_members")).toBe(true));
    it("OWNER can manage members", () => expect(can("OWNER", "manage_members")).toBe(true));
  });

  describe("view_audit_logs action", () => {
    it("VIEWER cannot view audit logs", () => expect(can("VIEWER", "view_audit_logs")).toBe(false));
    it("MEMBER cannot view audit logs", () => expect(can("MEMBER", "view_audit_logs")).toBe(false));
    it("ADMIN can view audit logs", () => expect(can("ADMIN", "view_audit_logs")).toBe(true));
    it("OWNER can view audit logs", () => expect(can("OWNER", "view_audit_logs")).toBe(true));
  });

  describe("delete_org / transfer_ownership", () => {
    it("VIEWER cannot delete org", () => expect(can("VIEWER", "delete_org")).toBe(false));
    it("MEMBER cannot delete org", () => expect(can("MEMBER", "delete_org")).toBe(false));
    it("ADMIN cannot delete org", () => expect(can("ADMIN", "delete_org")).toBe(false));
    it("OWNER can delete org", () => expect(can("OWNER", "delete_org")).toBe(true));
    it("OWNER can transfer ownership", () => expect(can("OWNER", "transfer_ownership")).toBe(true));
    it("ADMIN cannot transfer ownership", () => expect(can("ADMIN", "transfer_ownership")).toBe(false));
  });
});
