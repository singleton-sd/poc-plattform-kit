'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy `/login` path — login lives at `/` when signed out. */
export default function LoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-bg p-6 text-fg-muted"
      data-testid="login-redirect"
    >
      Redirecting…
    </main>
  );
}
