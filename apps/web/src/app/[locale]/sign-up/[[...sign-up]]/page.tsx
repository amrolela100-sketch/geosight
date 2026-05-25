import { SignUp } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';

export default function SignUpPage() {
  const t = useTranslations('Auth');

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t('signUp.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('signUp.subtitle')}</p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-glow border border-border bg-card/60 backdrop-blur',
            },
          }}
        />
      </div>
    </main>
  );
}
