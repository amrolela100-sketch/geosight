import { NextResponse, type NextRequest } from 'next/server';
import { Webhook } from 'svix';

import { eq, organizations, users } from '@geosight/db';

import { getServiceDb } from '@/lib/db';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

// Clerk webhook payload shapes (only the fields we need).
type ClerkEmailAddress = { id: string; email_address: string };

type ClerkUserData = {
  id: string;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

type ClerkOrgData = {
  id: string;
  name: string;
  slug: string;
};

type ClerkOrgMembershipData = {
  organization: { id: string };
  public_user_data: { user_id: string };
  role: string;
};

type ClerkEvent =
  | { type: 'user.created' | 'user.updated'; data: ClerkUserData }
  | { type: 'organization.created' | 'organization.updated'; data: ClerkOrgData }
  | {
      type: 'organizationMembership.created' | 'organizationMembership.updated';
      data: ClerkOrgMembershipData;
    }
  | { type: string; data: unknown };

function clerkRoleToOrgRole(role: string): 'owner' | 'admin' | 'member' | 'viewer' {
  // Clerk default roles: org:admin, org:member. Custom roles may exist.
  if (role === 'org:admin' || role === 'admin') return 'admin';
  if (role === 'org:owner' || role === 'owner') return 'owner';
  if (role === 'org:viewer' || role === 'viewer') return 'viewer';
  return 'member';
}

function primaryEmail(data: ClerkUserData): string {
  const byId = data.primary_email_address_id
    ? data.email_addresses.find((e) => e.id === data.primary_email_address_id)
    : undefined;
  return byId?.email_address ?? data.email_addresses[0]?.email_address ?? '';
}

function fullName(data: ClerkUserData): string | null {
  const parts = [data.first_name, data.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CLERK_WEBHOOK_SECRET is not configured.' },
      { status: 503 },
    );
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers.' }, { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(secret);

  let event: ClerkEvent;
  try {
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkEvent;
  } catch (err) {
    console.error('[clerk-webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  const db = getServiceDb();

  try {
    switch (event.type) {
      case 'organization.created':
      case 'organization.updated': {
        const data = event.data as ClerkOrgData;
        await db
          .insert(organizations)
          .values({
            clerkOrgId: data.id,
            name: data.name,
            slug: data.slug,
          })
          .onConflictDoUpdate({
            target: organizations.clerkOrgId,
            set: { name: data.name, slug: data.slug, updatedAt: new Date() },
          });
        break;
      }

      case 'user.created':
      case 'user.updated': {
        const data = event.data as ClerkUserData;
        const email = primaryEmail(data);
        if (!email) {
          console.warn('[clerk-webhook] user without email, skipping:', data.id);
          break;
        }
        // We can't insert without an org_id (FK NOT NULL). User row is created
        // when the membership webhook fires — here we only handle updates if
        // the user already exists.
        const existing = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.clerkUserId, data.id))
          .limit(1);
        if (existing.length > 0) {
          await db
            .update(users)
            .set({
              email,
              fullName: fullName(data),
              avatarUrl: data.image_url ?? null,
              updatedAt: new Date(),
            })
            .where(eq(users.clerkUserId, data.id));
        }
        break;
      }

      case 'organizationMembership.created':
      case 'organizationMembership.updated': {
        const data = event.data as ClerkOrgMembershipData;
        const orgRow = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.clerkOrgId, data.organization.id))
          .limit(1);
        if (orgRow.length === 0) {
          console.warn(
            '[clerk-webhook] membership references unknown org, skipping:',
            data.organization.id,
          );
          break;
        }
        const orgId = orgRow[0]!.id;
        const role = clerkRoleToOrgRole(data.role);

        // Find the existing user row (may not exist if user.created arrived
        // before the membership). Upsert by clerk_user_id.
        // Email/name come from a separate user.* event, so on first insert we
        // fill placeholders that user.updated will overwrite.
        await db
          .insert(users)
          .values({
            clerkUserId: data.public_user_data.user_id,
            email: `${data.public_user_data.user_id}@pending.geosight.local`,
            orgId,
            role,
          })
          .onConflictDoUpdate({
            target: users.clerkUserId,
            set: { orgId, role, updatedAt: new Date() },
          });
        break;
      }

      default:
        // Unhandled event type — ack so Clerk doesn't retry forever.
        break;
    }
  } catch (err) {
    console.error('[clerk-webhook] handler error:', err);
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
