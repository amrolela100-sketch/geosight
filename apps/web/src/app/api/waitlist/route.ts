import { NextResponse, type NextRequest } from 'next/server';
import { Resend } from 'resend';

import { waitlistEntries } from '@geosight/db';
import { waitlistEntrySchema } from '@geosight/shared/schemas';

import { getServiceDb } from '@/lib/db';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

function clientIp(req: NextRequest): string | null {
  // Vercel sets x-forwarded-for; first IP is the originating client.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return req.headers.get('x-real-ip');
}

async function sendConfirmationEmail(to: string, fullName: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // BYOK posture — owner doesn't pay. Skip silently when not configured.
    return;
  }
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'وصلت طلبك إلى قائمة الانتظار · GeoSight',
    html: `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="font-family: 'IBM Plex Sans Arabic', sans-serif; background:#0a0f1d; color:#e6e8ee; padding:32px;">
    <div style="max-width:540px; margin:0 auto; background:#111827; border:1px solid #1f2937; border-radius:12px; padding:32px;">
      <h1 style="font-size:20px; margin:0 0 16px;">أهلاً ${fullName} 👋</h1>
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

  const db = getServiceDb();

  try {
    await db.insert(waitlistEntries).values({
      fullName: data.fullName,
      email: data.email,
      company: data.company,
      website: data.website,
      country: data.country,
      brandCount: data.brandCount,
      notes: data.notes,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      ipAddress: clientIp(req),
      userAgent: req.headers.get('user-agent'),
    });
  } catch (err) {
    console.error('[waitlist] insert failed:', err);
    return NextResponse.json({ error: 'DatabaseError' }, { status: 500 });
  }

  // Email is fire-and-forget — a slow Resend response shouldn't make the
  // user wait or fail the request. Errors are logged for debugging.
  void sendConfirmationEmail(data.email, data.fullName).catch((err) => {
    console.error('[waitlist] confirmation email failed:', err);
  });

  return NextResponse.json({ ok: true });
}
