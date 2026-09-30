import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import type { AuthenticatedUser } from "./authenticated-user.js";
import { authenticatedUserFromToken } from "./jwt-auth.guard.js";

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return true;

    try {
      request.user = authenticatedUserFromToken(
        header.slice("Bearer ".length).trim(),
      );
    } catch {
      request.user = undefined;
    }
    return true;
  }
}
