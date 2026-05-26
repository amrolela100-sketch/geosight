import { SignUp } from '@clerk/nextjs';
import { useLocale, useTranslations } from 'next-intl';

export default function SignUpPage() {
  const locale = useLocale();
  const t = useTranslations('Auth');
  const prefix = locale === 'ar' ? '' : `/${locale}`;

  return (
    <main className="dashboard-aura relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 opacity-35" />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="gemini-border glass mb-2 flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold text-white">
            GS
          </div>
          <h1 className="text-2xl font-semibold text-white">{t('signUp.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('signUp.subtitle')}</p>
        </div>
        <SignUp
          fallbackRedirectUrl={`${prefix}/dashboard`}
          signInUrl={`${prefix}/sign-in`}
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-soft border border-white/10 bg-card/70 backdrop-blur-xl',
              headerTitle: 'text-white',
              headerSubtitle: 'text-muted-foreground',
              socialButtonsBlockButton:
                'border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]',
              formFieldInput:
                'border-white/10 bg-background/70 text-white focus:border-primary focus:ring-primary',
              formButtonPrimary: 'bg-primary text-primary-foreground shadow-glow hover:opacity-95',
              footerActionLink: 'text-primary',
            },
          }}
        />
      </div>
    </main>
  );
}
