import type { UserRole } from "@/types/database";

// Guard rails for destructive account operations. Pure so they can be unit
// tested; the server actions call them with fresh data read from the database.

export type AccountGuardAction = "disable" | "delete";

export type GuardTarget = { id: string; role: UserRole; is_active: boolean };

/**
 * Returns an error message when the operation must be refused, otherwise null.
 * - A super admin can never disable or delete their own account.
 * - The last active super admin can never be disabled or deleted.
 */
export function accountGuardError(input: {
  action: AccountGuardAction;
  actorId: string;
  target: GuardTarget;
  activeSuperAdmins: number;
}): string | null {
  const { action, actorId, target, activeSuperAdmins } = input;
  const verb = action === "disable" ? "disable" : "delete";

  if (target.id === actorId) return `You cannot ${verb} your own account.`;

  const countsAsActiveSuperAdmin = target.role === "super_admin" && target.is_active;
  if (countsAsActiveSuperAdmin && activeSuperAdmins <= 1) {
    return `You cannot ${verb} the last active super admin.`;
  }
  return null;
}

/** The typed confirmation for deleting a client must match their email. */
export function isDeleteConfirmed(typed: string, email: string): boolean {
  const value = typed.trim().toLowerCase();
  return value.length > 0 && value === email.trim().toLowerCase();
}
