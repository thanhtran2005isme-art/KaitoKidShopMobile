export interface KaitoKidBranch {
  code: string;
  name: string;
  province: string;
  district?: string | null;
  address?: string | null;
  phone?: string | null;
  active: boolean;
}

export interface ShippingConfig {
  mockEnabled: boolean;
  ghnEnabled: boolean;
  ghtkEnabled: boolean;
  lalamoveEnabled: boolean;
  ghnBaseUrl: string;
  ghnToken: string | null;
  ghnShopId: string | null;
  ghnFromDistrictId: string;
  ghnToDistrictIdFallback: string;
  ghnToWardCodeFallback: string;
  ghtkBaseUrl: string;
  ghtkToken: string | null;
  ghtkPickProvince: string | null;
  ghtkPickDistrict: string | null;
  lalamoveBaseUrl: string;
  lalamoveMarket: string;
  lalamoveApiKey: string | null;
  lalamoveApiSecret: string | null;
  lalamoveServiceType: string;
  pickupAddress: string | null;
  pickupName: string | null;
  pickupPhone: string | null;
  defaultWeightGram: number;
  kaitoKidBranches: KaitoKidBranch[];
  mockOnlyServeBranches: boolean;
  mockFeeSameProvince: number;
  mockFeeNearbyProvince: number;
  mockFeeExpress: number;
  mockLeadTimeStandardHours: number;
  mockLeadTimeExpressHours: number;
}

export interface ShippingQuoteInput {
  provider?: string;
  toProvince: string;
  toDistrict: string;
  toWard?: string | null;
  toAddress?: string | null;
  weightGram: number;
  orderValue: number;
  deliverOption?: string | null;
  toDistrictId?: number | null;
  toWardCode?: string | null;
}

export interface ShippingQuoteOption {
  provider: string;
  serviceCode: string;
  serviceName: string;
  fee: number;
  insuranceFee: number;
  leadTimeHours: number;
  deliveryType: string | null;
}

function removeDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "d");
}

export function normalizeProvince(value: string | null | undefined): string {
  let result = (value ?? "").trim().toLowerCase();
  for (const prefix of ["tỉnh ", "thành phố ", "tp. ", "tp "]) {
    if (result.startsWith(prefix)) {
      result = result.slice(prefix.length);
      break;
    }
  }
  return removeDiacritics(result).trim();
}

const NORTH_HUBS = new Set([
  "ha noi", "hanoi", "hai phong", "bac ninh", "hung yen", "vinh phuc", "ha nam",
]);
const SOUTH_HUBS = new Set([
  "ho chi minh", "tphcm", "binh duong", "dong nai", "long an", "vung tau",
]);

export function calculateMockQuote(
  req: ShippingQuoteInput,
  cfg: ShippingConfig,
): ShippingQuoteOption[] {
  const province = normalizeProvince(req.toProvince);
  const branch = cfg.kaitoKidBranches.find(
    (item) =>
      item.active &&
      normalizeProvince(item.province) === province,
  );

  if (cfg.mockOnlyServeBranches && !branch) return [];

  const weightKg = Math.max(0.1, req.weightGram / 1000);
  let standardFee = branch
    ? cfg.mockFeeSameProvince
    : NORTH_HUBS.has(province) || SOUTH_HUBS.has(province)
      ? 30_000
      : 45_000;

  if (weightKg > 1) {
    standardFee += Math.ceil((weightKg - 1) / 0.5) * 5_000;
  }

  const standardLead = branch
    ? cfg.mockLeadTimeStandardHours
    : NORTH_HUBS.has(province) || SOUTH_HUBS.has(province)
      ? 24
      : 72;
  const expressLead = branch
    ? cfg.mockLeadTimeExpressHours
    : Math.max(6, Math.trunc(standardLead / 2));

  return [
    {
      provider: "mock",
      serviceCode: "standard",
      serviceName: branch ? `Giao từ ${branch.name}` : "Tiêu chuẩn",
      fee: standardFee,
      insuranceFee: 0,
      leadTimeHours: standardLead,
      deliveryType: "road",
    },
    {
      provider: "mock",
      serviceCode: "express",
      serviceName: branch ? "Hỏa tốc nội thành" : "Hỏa tốc",
      fee: standardFee + cfg.mockFeeExpress,
      insuranceFee: 0,
      leadTimeHours: expressLead,
      deliveryType: "fly",
    },
  ];
}

export function estimateGhtkLeadHours(province: string): number {
  const value = province.toLowerCase();
  if (value.includes("hà nội") || value.includes("hồ chí minh")) return 24;
  if (value.includes("đà nẵng") || value.includes("hải phòng")) return 36;
  return 72;
}

export function valueCaseInsensitive(
  source: Record<string, unknown>,
  name: string,
): unknown {
  const target = name.toLowerCase();
  const entry = Object.entries(source).find(
    ([key]) => key.toLowerCase() === target,
  );
  return entry?.[1];
}

export function boolValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string" && /^true$/i.test(value)) return true;
  if (typeof value === "string" && /^false$/i.test(value)) return false;
  return fallback;
}

export function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeGhnName(value: string | null | undefined): string {
  let result = (value ?? "").trim().toLowerCase();
  for (const prefix of [
    "tỉnh ", "thành phố ", "tp. ", "tp ", "huyện ", "quận ",
    "thị xã ", "xã ", "phường ", "thị trấn ",
  ]) {
    if (result.startsWith(prefix)) {
      result = result.slice(prefix.length);
      break;
    }
  }
  return removeDiacritics(result)
    .replaceAll(" ", "")
    .replaceAll("-", "")
    .trim();
}
