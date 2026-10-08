import "dotenv/config";
import { lalamoveRequest } from "../modules/shipping/lalamove.client.js";

type JsonRecord = Record<string, any>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function env(name: string, fallback = ""): string {
  return text(process.env[name]) || fallback;
}

function required(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}

function assertE164(name: string, value: string): string {
  if (!/^\+[1-9]\d{1,14}$/.test(value)) {
    throw new Error(
      `${name} phải theo chuẩn E.164, ví dụ +84901234567 (không khoảng trắng, không số 0 sau mã quốc gia).`,
    );
  }
  return value;
}

function optionalCoordinate(name: string, value: string, min: number, max: number): string {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${name} không hợp lệ; giá trị phải nằm trong khoảng ${min}..${max}.`);
  }
  return value;
}

function deliveryStop(
  address: string,
  latEnv: string,
  lngEnv: string,
): JsonRecord {
  const lat = env(latEnv);
  const lng = env(lngEnv);
  if (Boolean(lat) !== Boolean(lng)) {
    throw new Error(`Phải khai báo đồng thời ${latEnv} và ${lngEnv}, hoặc bỏ cả hai.`);
  }
  if (!lat || !lng) return { address };

  return {
    address,
    coordinates: {
      lat: optionalCoordinate(latEnv, lat, -90, 90),
      lng: optionalCoordinate(lngEnv, lng, -180, 180),
    },
  };
}

async function json(response: Response): Promise<JsonRecord> {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return record(JSON.parse(raw));
  } catch {
    return { message: raw.slice(0, 500) };
  }
}

function fail(step: string, response: Response, payload: JsonRecord): never {
  const message = text(payload.message)
    || text(record(payload.errors).message)
    || `HTTP ${response.status}`;
  if (message === "ERR_REVERSE_GEOCODE_FAILURE") {
    throw new Error(
      `${step} thất bại: ${message}. Hãy bổ sung cặp LAT/LNG cho pickup/drop-off trong apps/api/.env.`,
    );
  }
  throw new Error(`${step} thất bại: ${message}`);
}

async function main() {
  const baseUrl = env("LALAMOVE_BASE_URL", "https://rest.sandbox.lalamove.com");
  if (!baseUrl.includes("sandbox.lalamove.com")) {
    throw new Error(
      "Smoke script chỉ cho phép Lalamove Sandbox. Hãy đặt LALAMOVE_BASE_URL=https://rest.sandbox.lalamove.com",
    );
  }

  const config = {
    baseUrl,
    market: env("LALAMOVE_MARKET", "VN"),
    apiKey: required("LALAMOVE_API_KEY"),
    apiSecret: required("LALAMOVE_API_SECRET"),
  };
  if (!config.apiKey.startsWith("pk_test_")) {
    throw new Error("LALAMOVE_API_KEY phải là sandbox key có prefix pk_test_.");
  }
  if (!config.apiSecret.startsWith("sk_test_")) {
    throw new Error("LALAMOVE_API_SECRET phải là sandbox secret có prefix sk_test_.");
  }

  const pickupAddress = required("LALAMOVE_PICKUP_ADDRESS");
  const pickupName = env("LALAMOVE_PICKUP_NAME", "KaitoKid Sandbox");
  const pickupPhone = assertE164(
    "LALAMOVE_PICKUP_PHONE",
    required("LALAMOVE_PICKUP_PHONE"),
  );
  const dropoffAddress = required("LALAMOVE_SANDBOX_DROPOFF_ADDRESS");
  const dropoffName = env("LALAMOVE_SANDBOX_DROPOFF_NAME", "KaitoKid Test Customer");
  const dropoffPhone = assertE164(
    "LALAMOVE_SANDBOX_DROPOFF_PHONE",
    required("LALAMOVE_SANDBOX_DROPOFF_PHONE"),
  );
  const serviceType = env("LALAMOVE_SERVICE_TYPE", "MOTORCYCLE");
  const pickupStop = deliveryStop(
    pickupAddress,
    "LALAMOVE_PICKUP_LAT",
    "LALAMOVE_PICKUP_LNG",
  );
  const dropoffStop = deliveryStop(
    dropoffAddress,
    "LALAMOVE_SANDBOX_DROPOFF_LAT",
    "LALAMOVE_SANDBOX_DROPOFF_LNG",
  );

  console.log("[1/4] Create quotation...");
  const quotationResponse = await lalamoveRequest(
    config,
    "POST",
    "/v3/quotations",
    {
      data: {
        serviceType,
        language: "vi_VN",
        stops: [pickupStop, dropoffStop],
      },
    },
  );
  const quotationPayload = await json(quotationResponse);
  if (!quotationResponse.ok) fail("Create quotation", quotationResponse, quotationPayload);

  const quotation = record(quotationPayload.data);
  const quotationId = text(quotation.quotationId);
  const stops = Array.isArray(quotation.stops) ? quotation.stops.map(record) : [];
  const pickupStopId = text(stops[0]?.stopId);
  const dropoffStopId = text(stops[stops.length - 1]?.stopId);
  if (!quotationId || !pickupStopId || !dropoffStopId) {
    throw new Error("Quotation không trả đủ quotationId/stopId.");
  }
  console.log(`Quotation OK: ${quotationId}`);
  console.log(`Fee: ${text(record(quotation.priceBreakdown).total) || "unknown"}`);

  console.log("[2/4] Place sandbox order...");
  const placeResponse = await lalamoveRequest(
    config,
    "POST",
    "/v3/orders",
    {
      data: {
        quotationId,
        sender: {
          stopId: pickupStopId,
          name: pickupName,
          phone: pickupPhone,
        },
        recipients: [{
          stopId: dropoffStopId,
          name: dropoffName,
          phone: dropoffPhone,
          remarks: "KaitoKid automated sandbox smoke test",
        }],
        isPODEnabled: true,
        metadata: {
          source: "kaitokid-sandbox-smoke",
          runAt: new Date().toISOString(),
        },
      },
    },
  );
  const placePayload = await json(placeResponse);
  if (!placeResponse.ok) fail("Place Order", placeResponse, placePayload);

  const placed = record(placePayload.data);
  const orderId = text(placed.orderId);
  if (!orderId) throw new Error("Place Order không trả orderId.");
  console.log(`Place Order OK: ${orderId}`);

  console.log("[3/4] Get order details...");
  const detailResponse = await lalamoveRequest(
    config,
    "GET",
    `/v3/orders/${encodeURIComponent(orderId)}`,
  );
  const detailPayload = await json(detailResponse);
  if (!detailResponse.ok) fail("Get Order", detailResponse, detailPayload);
  const detail = record(detailPayload.data);
  console.log(`Status: ${text(detail.status) || "unknown"}`);
  console.log(`Share link: ${text(detail.shareLink) || "not-returned"}`);

  if (/^(0|false|no)$/i.test(env("LALAMOVE_SANDBOX_CANCEL_AFTER", "true"))) {
    console.log("[4/4] Cancel skipped by LALAMOVE_SANDBOX_CANCEL_AFTER=false");
    return;
  }

  console.log("[4/4] Cancel sandbox order...");
  const cancelResponse = await lalamoveRequest(
    config,
    "DELETE",
    `/v3/orders/${encodeURIComponent(orderId)}`,
  );
  if (cancelResponse.status !== 204) {
    const cancelPayload = await json(cancelResponse);
    fail("Cancel Order", cancelResponse, cancelPayload);
  }
  console.log("Cancel OK: HTTP 204");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
