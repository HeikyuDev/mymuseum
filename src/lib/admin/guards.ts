import type { UserRole } from "@/types/database";

// Guard rails for destructive account operations. Pure so they can be unit
// tested; the server actions call them with fresh data read from the database.

export type AccountGuardAction = "disable" | "delete";

export type GuardTarget = { id: string; role: UserRole; is_active: boolean };

/**
 * Returns a message key (see `guard.*` in the dictionaries) when the operation
 * must be refused, otherwise null.
 * - A platform administrator can never disable or delete their own account.
 * - The last active platform administrator can never be disabled or deleted.
 */
export function accountGuardError(input: {
  action: AccountGuardAction;
  actorId: string;
  target: GuardTarget;
  activeSuperAdmins: number;
}): "guard.selfDisable" | "guard.selfDelete" | "guard.lastDisable" | "guard.lastDelete" | null {
  const { action, actorId, target, activeSuperAdmins } = input;
  const disabling = action === "disable";

  if (target.id === actorId) return disabling ? "guard.selfDisable" : "guard.selfDelete";

  const countsAsActiveSuperAdmin = target.role === "super_admin" && target.is_active;
  if (countsAsActiveSuperAdmin && activeSuperAdmins <= 1) {
    return disabling ? "guard.lastDisable" : "guard.lastDelete";
  }
  return null;
}

/** The typed confirmation for deleting a client must match their email. */
export function isDeleteConfirmed(typed: string, email: string): boolean {
  const value = typed.trim().toLowerCase();
  return value.length > 0 && value === email.trim().toLowerCase();
}
