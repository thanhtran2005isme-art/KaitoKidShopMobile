import { Module } from "@nestjs/common";
import { AuthEmailService } from "./email.service.js";
import { FacebookAuthService } from "./facebook-auth.service.js";
import { GoogleAuthService } from "./google-auth.service.js";
import { LoginActivityService } from "./login-activity.service.js";
import { OtpService } from "./otp.service.js";
import { RecaptchaService } from "./recaptcha.service.js";
import { StaffAuthController } from "./staff-auth.controller.js";
import { StaffAuthService } from "./staff-auth.service.js";
import { StaffManagementController } from "./staff-management.controller.js";
import { StaffManagementService } from "./staff-management.service.js";
import { TokenService } from "./token.service.js";
import { TwoFactorService } from "./two-factor.service.js";
import { UserAuthController } from "./user-auth.controller.js";
import { UserAuthService } from "./user-auth.service.js";

@Module({
  controllers: [
    UserAuthController,
    StaffAuthController,
    StaffManagementController,
  ],
  providers: [
    TokenService,
    AuthEmailService,
    RecaptchaService,
    GoogleAuthService,
    FacebookAuthService,
    TwoFactorService,
    LoginActivityService,
    OtpService,
    UserAuthService,
    StaffAuthService,
    StaffManagementService,
  ],
  exports: [AuthEmailService],
})
export class IdentityModule {}
