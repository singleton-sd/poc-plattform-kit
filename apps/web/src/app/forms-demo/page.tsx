import Link from 'next/link';
import { CreateProjectForm } from '@/features/forms-demo/create-project-form';

export default function FormsDemoPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-bg px-6 py-10 text-fg">
      <div className="flex flex-col gap-2">
        <Link className="text-sm text-accent underline" href="/">
          Back to home
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Schema-driven form demo</h1>
        <p className="text-fg-muted">
          Zod defines this create-project form, JSON Schema describes it, and custom token renderers
          provide every control.
        </p>
      </div>
      <CreateProjectForm />
    </main>
  );
}
