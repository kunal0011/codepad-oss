import { ParticipantRole } from "@codepad/shared";
import { logger } from "../utils/logger.js";

export enum Permission {
  EDIT = "edit",
  EXECUTE = "execute",
  VIEW_OUTPUT = "view_output",
  MANAGE_PARTICIPANTS = "manage_participants",
  PRIVATE_NOTES = "private_notes",
}

const ROLE_PERMISSIONS: Record<ParticipantRole, Permission[]> = {
  [ParticipantRole.OWNER]: [
    Permission.EDIT,
    Permission.EXECUTE,
    Permission.VIEW_OUTPUT,
    Permission.MANAGE_PARTICIPANTS,
    Permission.PRIVATE_NOTES,
  ],
  [ParticipantRole.INTERVIEWER]: [
    Permission.EDIT,
    Permission.EXECUTE,
    Permission.VIEW_OUTPUT,
    Permission.PRIVATE_NOTES,
  ],
  [ParticipantRole.EDITOR]: [
    Permission.EDIT,
    Permission.EXECUTE,
    Permission.VIEW_OUTPUT,
  ],
  [ParticipantRole.VIEWER]: [
    Permission.VIEW_OUTPUT,
  ],
};

export class PermissionManager {
  private userRoles = new Map<string, Map<string, ParticipantRole>>(); // sessionId -> userId -> role

  setRole(sessionId: string, userId: string, role: ParticipantRole): void {
    if (!this.userRoles.has(sessionId)) {
      this.userRoles.set(sessionId, new Map());
    }
    this.userRoles.get(sessionId)!.set(userId, role);
    logger.info({ sessionId, userId, role }, "User role updated");
  }

  getRole(sessionId: string, userId: string): ParticipantRole {
    const sessionRoles = this.userRoles.get(sessionId);
    return sessionRoles?.get(userId) ?? ParticipantRole.VIEWER;
  }

  can(sessionId: string, userId: string, permission: Permission): boolean {
    const role = this.getRole(sessionId, userId);
    return ROLE_PERMISSIONS[role].includes(permission);
  }

  removeSession(sessionId: string): void {
    this.userRoles.delete(sessionId);
  }
}

export const permissionManager = new PermissionManager();
