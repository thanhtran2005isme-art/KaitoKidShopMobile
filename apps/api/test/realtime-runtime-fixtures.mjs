import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { io } from "socket.io-client";
import { hashPassword } from "../dist/modules/identity/password.js";

export const base = (process.env.NODE_BASE_URL ?? "http://127.0.0.1:5300").replace(/\/+$/, "");
const socketPath = process.env.CHAT_SOCKET_PATH ?? "/chatHub";

export function number(value) {
  return Number(value ?? 0);
}

export function requiredConfirmation() {
  if ((process.env.RUNTIME_REALTIME_CONFIRM ?? "").trim().toUpperCase() !== "YES") {
    throw new Error(
      "Realtime gate co mutation. Chay scripts\\node-realtime-runtime-gate.bat de backup DB truoc.",
    );
  }
}

export async function call(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { response, data };
}

export function ok(result) {
  return result.response.status >= 200 && result.response.status < 300;
}

export function summary(result) {
  let body;
  try { body = JSON.stringify(result.data); } catch { body = String(result.data ?? ""); }
  return `HTTP ${result.response.status} body=${body}`;
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function connectSocket(auth) {
  return new Promise((resolve, reject) => {
    const socket = io(base, {
      path: socketPath,
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      timeout: 5000,
      auth,
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Socket.IO connect timeout"));
    }, 7000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(error);
    });
  });
}

export function waitForEvent(socket, event, predicate = () => true, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting Socket.IO event ${event}`));
    }, timeoutMs);
    const handler = (...args) => {
      try {
        if (!predicate(...args)) return;
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(args);
      } catch (error) {
        clearTimeout(timer);
        socket.off(event, handler);
        reject(error);
      }
    };
    socket.on(event, handler);
  });
}

export async function botMessageCount(prisma, conversationId) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS count FROM TinNhan WHERE CuocHoiThoaiId = ? AND LoaiNguoiGui = 'bot'",
    conversationId,
  );
  return number(rows[0]?.count);
}

export async function createStaffFixtures(prisma, context) {
  const suffix = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const roleCode = `p11c-${suffix}`;
  const password = `Phase11-${randomBytes(8).toString("hex")}!`;
  const hash = await hashPassword(password);

  const permissions = await prisma.$queryRawUnsafe(
    `SELECT Id AS id, MaQuyen AS code FROM QuyenHan
     WHERE MaQuyen IN ('chat.view','chat.reply') ORDER BY MaQuyen`,
  );
  assert.deepEqual(
    permissions.map((row) => String(row.code)).sort(),
    ["chat.reply", "chat.view"],
    "DB thieu chat.view/chat.reply",
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO VaiTro (MaVaiTro, TenVaiTro, MoTa, TrangThai, LaMacDinh, NgayTao)
     VALUES (?, 'Phase 11 Chat Fixture', 'Temporary realtime runtime fixture', 1, 0, ?)`,
    roleCode,
    new Date(),
  );
  const roleRows = await prisma.$queryRawUnsafe(
    "SELECT Id AS id FROM VaiTro WHERE MaVaiTro = ? LIMIT 1",
    roleCode,
  );
  context.roleId = number(roleRows[0]?.id);
  assert.ok(context.roleId > 0, "Khong tao duoc role fixture realtime");

  for (const permission of permissions) {
    await prisma.$executeRawUnsafe(
      "INSERT INTO VaiTro_QuyenHan (VaiTroId, QuyenHanId) VALUES (?, ?)",
      context.roleId,
      number(permission.id),
    );
  }

  for (const index of [1, 2]) {
    const email = `phase11-chat-${index}-${suffix}@example.invalid`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO NhanVien
       (Email, MatKhauHash, HoTen, SoDienThoai, AnhDaiDien, VaiTroId,
        NgaySinh, GioiTinh, DiaChi, NgayVaoLam, TrangThai, GhiChu, NgayTao)
       VALUES (?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, ?, 1, 'Temporary realtime runtime fixture', ?)`,
      email,
      hash,
      `Phase 11 Chat Staff ${index}`,
      context.roleId,
      new Date(),
      new Date(),
    );
    const rows = await prisma.$queryRawUnsafe(
      "SELECT Id AS id FROM NhanVien WHERE Email = ? LIMIT 1",
      email,
    );
    const id = number(rows[0]?.id);
    assert.ok(id > 0, `Khong tao duoc staff fixture ${index}`);
    context.staff.push({ id, email, password });
  }
  return context.staff;
}

export async function loginStaff(staff) {
  const result = await call("/api/auth/staff/login", {
    method: "POST",
    body: { email: staff.email, password: staff.password },
  });
  assert.ok(ok(result), `Staff login fail: ${summary(result)}`);
  assert.equal(number(result.data?.user?.id), staff.id);
  const permissions = Array.isArray(result.data?.user?.permissions) ? result.data.user.permissions : [];
  assert.ok(permissions.includes("chat.view"));
  assert.ok(permissions.includes("chat.reply"));
  assert.ok(result.data?.accessToken);
  return String(result.data.accessToken);
}

export async function cleanup(prisma, context) {
  if (context.conversationId) {
    await prisma.$executeRawUnsafe("DELETE FROM TinNhan WHERE CuocHoiThoaiId = ?", context.conversationId);
    await prisma.$executeRawUnsafe("DELETE FROM CuocHoiThoai WHERE Id = ?", context.conversationId);
  }
  if (context.roleId) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM LichSuDangNhapNV
       WHERE NhanVienId IN (SELECT Id FROM NhanVien WHERE VaiTroId = ?)`,
      context.roleId,
    );
    await prisma.$executeRawUnsafe("DELETE FROM NhanVien WHERE VaiTroId = ?", context.roleId);
    await prisma.$executeRawUnsafe("DELETE FROM VaiTro_QuyenHan WHERE VaiTroId = ?", context.roleId);
    await prisma.$executeRawUnsafe("DELETE FROM VaiTro WHERE Id = ?", context.roleId);
  }
}
