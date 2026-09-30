import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { pathInt } from "../../common/query-value.js";
import {
  assertStaffPermission,
  hasStaffPermission,
  isSuperAdmin,
} from "./staff-permissions.js";
import { StaffManagementService } from "./staff-management.service.js";

function optionalInt(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new BadRequestException({
      message: "roleId không hợp lệ.",
    });
  }
  return parsed;
}

function optionalBool(
  value: string | undefined,
): boolean | null {
  if (value === undefined || value === "") return null;
  if (/^true$/i.test(value)) return true;
  if (/^false$/i.test(value)) return false;
  throw new BadRequestException({
    message: "active không hợp lệ.",
  });
}

@Controller("api/auth/staff-management")
@UseGuards(JwtAuthGuard)
export class StaffManagementController {
  constructor(
    private readonly management: StaffManagementService,
  ) {}

  @Get("roles")
  roles(@CurrentUser() user: AuthenticatedUser) {
    if (
      !hasStaffPermission(user, "staff.view") &&
      !hasStaffPermission(user, "roles.manage")
    ) {
      assertStaffPermission(user, "roles.manage");
    }
    return this.management.roles();
  }

  @Post("roles")
  createRole(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    assertStaffPermission(user, "roles.manage");
    return this.management.createRole(body);
  }

  @Put("roles/:id")
  updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body: Record<string, unknown>,
  ) {
    assertStaffPermission(user, "roles.manage");
    return this.management.updateRole(
      pathInt(rawId),
      body,
    );
  }

  @Delete("roles/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ): Promise<void> {
    assertStaffPermission(user, "roles.manage");
    await this.management.deleteRole(pathInt(rawId));
  }

  @Get("permissions")
  permissions(@CurrentUser() user: AuthenticatedUser) {
    if (
      !hasStaffPermission(user, "staff.view") &&
      !hasStaffPermission(user, "roles.manage")
    ) {
      assertStaffPermission(user, "roles.manage");
    }
    return this.management.permissions();
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("search") search?: string,
    @Query("roleId") rawRoleId?: string,
    @Query("active") rawActive?: string,
  ) {
    assertStaffPermission(user, "staff.view");
    return this.management.list(
      search,
      optionalInt(rawRoleId),
      optionalBool(rawActive),
    );
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    assertStaffPermission(user, "staff.manage");
    return this.management.create(body);
  }

  @Post(":id/reset-password")
  resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body: Record<string, unknown>,
  ) {
    assertStaffPermission(user, "staff.manage");
    return this.management.resetPassword(
      pathInt(rawId),
      typeof body.newPassword === "string"
        ? body.newPassword
        : "",
    );
  }

  @Post(":id/unlock")
  unlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ) {
    assertStaffPermission(user, "staff.manage");
    return this.management.unlock(pathInt(rawId));
  }

  @Get(":id")
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ) {
    assertStaffPermission(user, "staff.view");
    return this.management.getById(pathInt(rawId));
  }

  @Put(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
    @Body() body: Record<string, unknown>,
  ) {
    assertStaffPermission(user, "staff.manage");
    return this.management.update(
      user.id,
      isSuperAdmin(user),
      pathInt(rawId),
      body,
    );
  }

  @Delete(":id")
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") rawId: string,
  ) {
    assertStaffPermission(user, "staff.manage");
    return this.management.softDelete(
      user.id,
      pathInt(rawId),
    );
  }
}
