export const PLAN_NAMES = ['starter', 'growth', 'agency', 'enterprise'] as const;
export type PlanName = (typeof PLAN_NAMES)[number];

export interface PlanLimits {
  readonly maxKeywords: number;
  readonly maxProviders: number;
  readonly maxBrands: number;
  readonly maxTeamMembers: number;
  readonly allowsManagedKeys: boolean;
  readonly allowsWhiteLabel: boolean;
  readonly allowsApiAccess: boolean;
  readonly monthlyPriceUsd: number;
}

export const PLANS: Readonly<Record<PlanName, PlanLimits>> = {
  starter: {
    maxKeywords: 25,
    maxProviders: 2,
    maxBrands: 1,
    maxTeamMembers: 2,
    allowsManagedKeys: false,
    allowsWhiteLabel: false,
    allowsApiAccess: false,
    monthlyPriceUsd: 29,
  },
  growth: {
    maxKeywords: 100,
    maxProviders: 3,
    maxBrands: 3,
    maxTeamMembers: 5,
    allowsManagedKeys: false,
    allowsWhiteLabel: true,
    allowsApiAccess: false,
    monthlyPriceUsd: 79,
  },
  agency: {
    maxKeywords: 500,
    maxProviders: 3,
    maxBrands: 25,
    maxTeamMembers: 20,
    allowsManagedKeys: true,
    allowsWhiteLabel: true,
    allowsApiAccess: true,
    monthlyPriceUsd: 199,
  },
  enterprise: {
    maxKeywords: Number.POSITIVE_INFINITY,
    maxProviders: 3,
    maxBrands: Number.POSITIVE_INFINITY,
    maxTeamMembers: Number.POSITIVE_INFINITY,
    allowsManagedKeys: true,
    allowsWhiteLabel: true,
    allowsApiAccess: true,
    monthlyPriceUsd: 0, // negotiated per-customer
  },
};
