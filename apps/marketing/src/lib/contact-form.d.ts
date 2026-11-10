export const CONTACT_SUBJECTS: readonly ['general', 'sales', 'support', 'partnership'];
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

export const CONTACT_SUBJECT_OPTIONS: { value: ContactSubject; label: string }[];

export const CONTACT_FORM_SOURCE: 'Platform Kit contact form';

export const CONTACT_LIMITS: {
  nameMax: 120;
  emailMax: 254;
  companyMax: 120;
  phoneMax: 40;
  phoneMinDigits: 6;
  phoneMaxDigits: 15;
  messageMin: 10;
  messageMax: 5000;
};

export const CONTACT_MESSAGE_FIELD_MAX: number;

export function hasForbiddenControls(value: string, allowMessageWhitespace: boolean): boolean;
export function resolveInquirySubject(raw: string | null | undefined): ContactSubject | '';
export function subjectForPostKit(raw: string | null | undefined): ContactSubject;
export function buildContactMessagePrefix(input?: { company?: string; phone?: string }): string;
export function buildContactMessage(input: {
  message: string;
  company?: string;
  phone?: string;
}): string;
export function phoneDigitCount(raw: string): number;
export function isPlausiblePhone(raw: string): boolean;

export type ContactFormFields = {
  name: string;
  email: string;
  company: string;
  phone: string;
  subject: string;
  message: string;
};

export type ContactFormErrors = Partial<Record<keyof ContactFormFields, string>>;

export function validateContactForm(fields: ContactFormFields): ContactFormErrors;
export function isContactFormValid(errors: ContactFormErrors): boolean;

export type PostKitContactPayload = {
  name: string;
  email: string;
  subject: ContactSubject;
  message: string;
};

export function buildPostKitContactPayload(
  fields: ContactFormFields,
): { ok: true; value: PostKitContactPayload } | { ok: false; errors: ContactFormErrors };
