import { Global, Module } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

@Global()
@Module({
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthCompatModule {}
