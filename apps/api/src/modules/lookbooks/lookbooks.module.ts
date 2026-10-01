import { Module } from "@nestjs/common";
import { LookbooksController } from "./lookbooks.controller.js";
import { LookbooksService } from "./lookbooks.service.js";

@Module({
  controllers: [LookbooksController],
  providers: [LookbooksService],
})
export class LookbooksModule {}
