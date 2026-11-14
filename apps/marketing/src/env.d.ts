/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_POSTKIT_API_BASE_URL?: string;
  /** Cloudflare Turnstile site key (public). Secret stays in job-kit. */
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  /** Optional override of https://api.singletonsd.com/v1/leads */
  readonly PUBLIC_LEAD_INTAKE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
