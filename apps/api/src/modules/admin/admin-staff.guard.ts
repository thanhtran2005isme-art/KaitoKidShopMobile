import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { isStaffUser } from "../identity/staff-permissions.js";

@Injectable()
export class AdminStaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user || !isStaffUser(request.user)) throw new ForbiddenException();
    return true;
  }
}
