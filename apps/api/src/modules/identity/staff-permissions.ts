import {
  ForbiddenException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";

function claimValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === "string",
    );
  }
  return [];
}

export function isStaffUser(user: AuthenticatedUser): boolean {
  return user.claims.user_type === "staff";
}

export function isSuperAdmin(
  user: AuthenticatedUser,
): boolean {
  return String(user.claims.is_super_admin).toLowerCase() === "true";
}

export function hasStaffPermission(
  user: AuthenticatedUser,
  permission: string,
): boolean {
  if (!isStaffUser(user)) return false;
  if (isSuperAdmin(user)) return true;
  return claimValues(user.claims.permission).includes(permission);
}

export function assertStaffPermission(
  user: AuthenticatedUser,
  permission: string,
): void {
  if (!hasStaffPermission(user, permission)) {
    throw new ForbiddenException();
  }
}
