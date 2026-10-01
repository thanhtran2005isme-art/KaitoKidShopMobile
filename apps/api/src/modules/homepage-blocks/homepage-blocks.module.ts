import { Module } from "@nestjs/common";
import { HomepageBlocksController } from "./homepage-blocks.controller.js";
import { HomepageBlocksService } from "./homepage-blocks.service.js";

@Module({
  controllers: [HomepageBlocksController],
  providers: [HomepageBlocksService],
})
export class HomepageBlocksModule {}
