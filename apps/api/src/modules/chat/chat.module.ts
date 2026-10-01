import { Module } from "@nestjs/common";
import { AdminChatController, ChatController } from "./chat.controller.js";
import { ChatBotService } from "./chat-bot.service.js";
import { ChatGateway } from "./chat.gateway.js";
import { ChatIdleSweeperService } from "./chat-idle-sweeper.service.js";
import { ChatService } from "./chat.service.js";
import { ChatSettingsService } from "./chat-settings.service.js";

@Module({
  controllers: [ChatController, AdminChatController],
  providers: [
    ChatSettingsService,
    ChatBotService,
    ChatService,
    ChatGateway,
    ChatIdleSweeperService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
