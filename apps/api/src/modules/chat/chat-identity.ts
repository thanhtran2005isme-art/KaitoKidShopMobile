import type { OptionalJwtUser } from "../../auth/jwt-optional.js";
import { tryAuthenticateBearer } from "../../auth/jwt-optional.js";
import type { ChatIdentity } from "./chat.types.js";

function permissions(user: OptionalJwtUser | null): string[] {
  if (!user) return [];
  const raw = user.claims.permission;
  if (typeof raw === "string") return [raw];
  return Array.isArray(raw)
    ? raw.filter((v): v is string => typeof v === "string")
    : [];
}

export function chatIdentityFromAuthorization(
  authorization: string | null | undefined,
  guestId?: string | null,
): ChatIdentity {
  const user = tryAuthenticateBearer(authorization);
  const isStaff = user?.claims.user_type === "staff";
  if (user && !isStaff) {
    return {
      userId: user.id,
      guestId: null,
      displayName: user.name ?? null,
      isStaff: false,
      permissions: [],
      superAdmin: false,
    };
  }
  return {
    userId: isStaff && user ? user.id : null,
    guestId: isStaff ? null : guestId?.trim() || null,
    displayName: isStaff ? user?.name ?? null : null,
    isStaff: Boolean(isStaff),
    permissions: permissions(user),
    superAdmin:
      String(user?.claims.is_super_admin).toLowerCase() === "true",
  };
}

export function canChat(
  identity: ChatIdentity,
  permission: string,
): boolean {
  return (
    identity.isStaff &&
    (identity.superAdmin || identity.permissions.includes(permission))
  );
}
