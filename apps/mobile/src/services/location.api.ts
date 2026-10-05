const BASE_URL = 'https://provinces.open-api.vn/api/v1';

export type Province = {
  code: number;
  name: string;
  division_type: string;
  codename: string;
  phone_code: number;
  districts?: District[];
};

export type District = {
  code: number;
  name: string;
  division_type: string;
  codename: string;
  province_code: number;
  wards?: Ward[];
};

export type Ward = {
  code: number;
  name: string;
  division_type: string;
  codename: string;
  district_code: number;
};

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(BASE_URL + path);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export const locationApi = {
  async getProvinces(): Promise<Province[]> {
    return (await getJson<Province[]>('/p/')) || [];
  },

  getProvinceWithDistricts(provinceCode: number) {
    return getJson<Province>(`/p/${provinceCode}?depth=2`);
  },

  getDistrictWithWards(districtCode: number) {
    return getJson<District>(`/d/${districtCode}?depth=2`);
  },
};
