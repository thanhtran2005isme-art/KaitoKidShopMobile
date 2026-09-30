import { Module } from "@nestjs/common";
import { AdminChatController } from "./admin-chat.controller.js";
import { ChatController } from "./chat.controller.js";
import { ChatBotService } from "./chat-bot.service.js";
import { ChatGateway } from "./chat.gateway.js";
import { ChatIdleSweeperService } from "./chat-idle-sweeper.service.js";
import { ChatService } from "./chat.service.js";

@Module({
  controllers: [ChatController, AdminChatController],
  providers: [
    ChatBotService,
    ChatService,
    ChatGateway,
    ChatIdleSweeperService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
