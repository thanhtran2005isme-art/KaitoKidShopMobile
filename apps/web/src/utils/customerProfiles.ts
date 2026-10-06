export type CustomerTier = 'new' | 'regular' | 'vip' | 'at-risk';
export type CustomerCareStatus = 'new-lead' | 'following' | 'vip-care' | 'reactivation';

export interface StoredCustomerProfile {
  email: string;
  careStatus: CustomerCareStatus;
  note: string;
  tags: string[];
  updatedAt?: string;
}

const STORAGE_KEY = 'customerProfiles';

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => asString(item)).filter(Boolean);
}

function normalizeStoredProfile(rawProfile: Partial<StoredCustomerProfile>): StoredCustomerProfile {
  return {
    email: asString(rawProfile.email),
    careStatus: rawProfile.careStatus === 'new-lead'
      || rawProfile.careStatus === 'vip-care'
      || rawProfile.careStatus === 'reactivation'
      ? rawProfile.careStatus
      : 'following',
    note: asString(rawProfile.note),
    tags: asStringArray(rawProfile.tags),
    updatedAt: asString(rawProfile.updatedAt) || undefined,
  };
}

export function readStoredCustomerProfiles(): Record<string, StoredCustomerProfile> {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.values(parsed as Record<string, StoredCustomerProfile>).reduce<Record<string, StoredCustomerProfile>>(
      (accumulator, profile) => {
        const normalizedProfile = normalizeStoredProfile(profile);

        if (normalizedProfile.email) {
          accumulator[normalizedProfile.email.toLowerCase()] = normalizedProfile;
        }

        return accumulator;
      },
      {},
    );
  } catch {
    return {};
  }
}

export function saveStoredCustomerProfiles(profiles: Record<string, StoredCustomerProfile>): Record<string, StoredCustomerProfile> {
  const normalizedProfiles = Object.entries(profiles).reduce<Record<string, StoredCustomerProfile>>(
    (accumulator, [email, profile]) => {
      const normalizedProfile = normalizeStoredProfile({ ...profile, email });

      if (normalizedProfile.email) {
        accumulator[normalizedProfile.email.toLowerCase()] = normalizedProfile;
      }

      return accumulator;
    },
    {},
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedProfiles));
  return normalizedProfiles;
}

export function getDefaultCareStatus(tier: CustomerTier): CustomerCareStatus {
  switch (tier) {
    case 'vip':
      return 'vip-care';
    case 'at-risk':
      return 'reactivation';
    case 'new':
      return 'new-lead';
    default:
      return 'following';
  }
}
