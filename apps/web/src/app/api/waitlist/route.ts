import { NextResponse, type NextRequest } from 'next/server';
import { Resend } from 'resend';

import { eq, waitlistEntries } from '@geosight/db';
import { waitlistEntrySchema } from '@geosight/shared/schemas';

import { getServiceDb } from '@/lib/db';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const recentSubmissions = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60_000;

function clientIp(req: NextRequest): string | null {
  // Vercel sets x-forwarded-for; first IP is the originating client.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return req.headers.get('x-real-ip');
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] ?? char,
  );
}

async function sendConfirmationEmail(to: string, fullName: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // BYOK posture — owner doesn't pay. Skip silently when not configured.
    return;
  }
  const safeFullName = escapeHtml(fullName);
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'وصلت طلبك إلى قائمة الانتظار · GeoSight',
    html: `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="font-family: 'IBM Plex Sans Arabic', sans-serif; background:#0a0f1d; color:#e6e8ee; padding:32px;">
    <div style="max-width:540px; margin:0 auto; background:#111827; border:1px solid #1f2937; border-radius:12px; padding:32px;">
      <h1 style="font-size:20px; margin:0 0 16px;">أهلاً ${safeFullName} 👋</h1>
      <p style="margin:0 0 12px; line-height:1.7;">
        وصلتنا طلبك للانضمام إلى قائمة انتظار GeoSight — أول منصة GEO عربية لتتبّع ظهور علامتك في إجابات الذكاء الاصطناعي.
      </p>
      <p style="margin:0 0 12px; line-height:1.7;">
        نفتح أبواب البيتا تدريجياً لوكالات تسويق عربية مختارة. سنتواصل معك عند فتح المقاعد الجديدة.
      </p>
      <p style="margin:24px 0 0; color:#9ca3af; font-size:13px;">— فريق GeoSight</p>
    </div>
  </body>
</html>`,
  });
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const previous = recentSubmissions.get(key);
  recentSubmissions.set(key, now);

  for (const [entryKey, timestamp] of recentSubmissions) {
    if (now - timestamp > RATE_LIMIT_WINDOW_MS) recentSubmissions.delete(entryKey);
  }

  return typeof previous === 'number' && now - previous < RATE_LIMIT_WINDOW_MS;
}

function isTransientDbError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|Connection terminated/i.test(message);
}

async function retryTransient<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (!isTransientDbError(err) || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw lastError;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null);
  const parsed = waitlistEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'ValidationError', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const normalizedEmail = data.email.toLowerCase();
  const ipAddress = clientIp(req);
  const rateLimitKey = `${ipAddress ?? 'unknown'}:${normalizedEmail}`;

  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json({ error: 'RateLimited' }, { status: 429 });
  }

  const db = getServiceDb();

  try {
    const status = await retryTransient(async () => {
      const existing = await db
        .select({ id: waitlistEntries.id })
        .from(waitlistEntries)
        .where(eq(waitlistEntries.email, normalizedEmail))
        .limit(1);

      if (existing.length > 0) return 'duplicate' as const;

      await db.insert(waitlistEntries).values({
        fullName: data.fullName,
        email: normalizedEmail,
        company: data.company,
        website: data.website,
        country: data.country,
        brandCount: data.brandCount,
        notes: data.notes,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        ipAddress,
        userAgent: req.headers.get('user-agent'),
      });

      return 'created' as const;
    });

    if (status === 'duplicate') {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  } catch (err) {
    console.error('[waitlist] insert failed:', err);
    if (isTransientDbError(err)) {
      return NextResponse.json({ error: 'DatabaseUnavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'DatabaseError' }, { status: 500 });
  }

  // Email is fire-and-forget — a slow Resend response shouldn't make the
  // user wait or fail the request. Errors are logged for debugging.
  void sendConfirmationEmail(data.email, data.fullName).catch((err) => {
    console.error('[waitlist] confirmation email failed:', err);
  });

  return NextResponse.json({ ok: true });
}
