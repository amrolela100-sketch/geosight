export const ORG_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ROLE_RANK: Readonly<Record<OrgRole, number>> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/** Returns true if `role` has at least the privilege level of `minimum`. */
export function hasAtLeast(role: OrgRole, minimum: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export const ROLE_DISPLAY: Readonly<Record<OrgRole, { ar: string; en: string; description: string }>> = {
  owner: {
    ar: 'مالك',
    en: 'Owner',
    description: 'Full access including billing, team management, and account deletion.',
  },
  admin: {
    ar: 'مسؤول',
    en: 'Admin',
    description: 'Manage team, brands, keywords, and API keys. Cannot delete the account.',
  },
  member: {
    ar: 'عضو',
    en: 'Member',
    description: 'View and edit brands and keywords. No access to billing or team management.',
  },
  viewer: {
    ar: 'مشاهد',
    en: 'Viewer',
    description: 'Read-only access to reports and dashboards.',
  },
};
