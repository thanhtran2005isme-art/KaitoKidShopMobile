import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { PrismaService } from "../dist/database/prisma.service.js";
import {
  botMessageCount,
  call,
  cleanup,
  connectSocket,
  createStaffFixtures,
  delay,
  loginStaff,
  number,
  ok,
  requiredConfirmation,
  summary,
  waitForEvent,
} from "./realtime-runtime-fixtures.mjs";

test("Phase 11 realtime Socket.IO + staff claim race runtime", async (t) => {
  requiredConfirmation();
  const prisma = new PrismaService();
  await prisma.$connect();

  const context = { conversationId: 0, roleId: 0, staff: [], winnerId: 0 };
  const sockets = [];

  try {
    const health = await call("/health");
    assert.ok(ok(health), `Node health fail: ${summary(health)}`);
    assert.equal(health.data?.database?.expectedTables, 52);
    assert.equal(health.data?.database?.actualTables, 52);

    const staffFixtures = await createStaffFixtures(prisma, context);
    const [token1, token2] = await Promise.all(staffFixtures.map(loginStaff));

    const guestId = `phase11-guest-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const otherGuestId = `${guestId}-other`;
    const conversation = await call("/api/chat/conversations", {
      method: "POST",
      body: { guestId },
    });
    assert.ok(ok(conversation), `Create guest conversation fail: ${summary(conversation)}`);
    context.conversationId = number(conversation.data?.id);
    assert.ok(context.conversationId > 0, "Khong doc duoc conversation fixture id");

    const guest = await connectSocket({ guestId });
    sockets.push(guest);
    guest.emit("JoinConversation", context.conversationId);
    await delay(150);

    await t.test("guest identity locked to handshake", async () => {
      const spoofText = `phase11-spoof-${Date.now()}`;
      guest.emit("SendMessage", {
        conversationId: context.conversationId,
        text: spoofText,
        guestId: otherGuestId,
      });
      await delay(300);
      const rows = await prisma.$queryRawUnsafe(
        "SELECT COUNT(*) AS count FROM TinNhan WHERE CuocHoiThoaiId = ? AND NoiDung = ?",
        context.conversationId,
        spoofText,
      );
      assert.equal(number(rows[0]?.count), 0, "Spoofed guestId wrote TinNhan");
    });

    const handoff = await call(
      `/api/chat/conversations/${context.conversationId}/handoff?guestId=${encodeURIComponent(guestId)}`,
      { method: "POST", body: { reason: "phase11 realtime runtime" } },
    );
    assert.ok(ok(handoff), `Request handoff fail: ${summary(handoff)}`);

    guest.disconnect();
    const guestReconnected = await connectSocket({ guestId });
    sockets.push(guestReconnected);
    guestReconnected.emit("JoinConversation", context.conversationId);
    await delay(150);

    const intruder = await connectSocket({ guestId: otherGuestId });
    sockets.push(intruder);
    let intruderMessages = 0;
    intruder.on("ReceiveMessage", () => { intruderMessages += 1; });
    intruder.emit("JoinConversation", context.conversationId);
    await delay(200);

    const staff1 = await connectSocket({ accessToken: token1 });
    const staff2 = await connectSocket({ accessToken: token2 });
    sockets.push(staff1, staff2);
    staff1.emit("JoinAgentQueue");
    staff2.emit("JoinAgentQueue");
    await delay(150);

    const botBeforeClaim = await botMessageCount(prisma, context.conversationId);
    let failed1 = 0;
    let failed2 = 0;
    staff1.on("ClaimFailed", (id) => {
      if (number(id) === context.conversationId) failed1 += 1;
    });
    staff2.on("ClaimFailed", (id) => {
      if (number(id) === context.conversationId) failed2 += 1;
    });

    await t.test("two staff claim same conversation exactly one wins", async () => {
      staff1.emit("ClaimConversation", context.conversationId);
      staff2.emit("ClaimConversation", context.conversationId);
      await delay(700);

      const rows = await prisma.$queryRawUnsafe(
        "SELECT TrangThai AS status, NhanVienId AS staffId FROM CuocHoiThoai WHERE Id = ? LIMIT 1",
        context.conversationId,
      );
      assert.equal(rows[0]?.status, "agent");
      const winnerId = number(rows[0]?.staffId);
      assert.ok(staffFixtures.some((staff) => staff.id === winnerId));
      assert.equal(failed1 + failed2, 1, "Claim race must emit exactly one ClaimFailed");
      assert.equal(
        await botMessageCount(prisma, context.conversationId),
        botBeforeClaim + 1,
        "Claim race must create exactly one system bot message",
      );
      context.winnerId = winnerId;
    });

    await t.test("guest reconnect + realtime send, intruder isolated", async () => {
      const customerText = `phase11-customer-${Date.now()}`;
      const receive = waitForEvent(
        guestReconnected,
        "ReceiveMessage",
        (message) => message?.content === customerText,
      );
      guestReconnected.emit("SendMessage", {
        conversationId: context.conversationId,
        text: customerText,
        guestId,
      });
      const [message] = await receive;
      assert.equal(message?.content, customerText);

      const rows = await prisma.$queryRawUnsafe(
        "SELECT COUNT(*) AS count FROM TinNhan WHERE CuocHoiThoaiId = ? AND NoiDung = ? AND LoaiNguoiGui = 'customer'",
        context.conversationId,
        customerText,
      );
      assert.equal(number(rows[0]?.count), 1);
    });

    await t.test("winning staff reply broadcasts only conversation room", async () => {
      assert.ok(context.winnerId > 0, "Missing winnerId after claim race");
      const winnerSocket = context.winnerId === staffFixtures[0].id ? staff1 : staff2;
      const agentText = `phase11-agent-${Date.now()}`;
      const receive = waitForEvent(
        guestReconnected,
        "ReceiveMessage",
        (message) => message?.content === agentText,
      );
      winnerSocket.emit("AgentSendMessage", {
        conversationId: context.conversationId,
        text: agentText,
      });
      const [message] = await receive;
      assert.equal(message?.content, agentText);
      await delay(200);
      assert.equal(intruderMessages, 0, "Non-owner guest received conversation message");

      const rows = await prisma.$queryRawUnsafe(
        "SELECT COUNT(*) AS count FROM TinNhan WHERE CuocHoiThoaiId = ? AND NoiDung = ? AND LoaiNguoiGui = 'agent'",
        context.conversationId,
        agentText,
      );
      assert.equal(number(rows[0]?.count), 1);
    });
  } finally {
    for (const socket of sockets) {
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch {}
    }
    await cleanup(prisma, context);
    await prisma.$disconnect();
  }
});
