import { buildLeadPayload, validateLeadValues } from './build-lead-payload.mjs';
import { LEAD_MESSAGE_MAX, createSubmissionId } from './lead-config.mjs';
import {
  RETRY_MESSAGE,
  TOKEN_ERROR_MESSAGE,
  TOKEN_EXPIRED_MESSAGE,
  TOKEN_REQUIRED_MESSAGE,
  VALIDATION_MESSAGE,
  submitLead,
} from './submit-lead.mjs';
import { stripBase } from '../with-base.mjs';

const FIELD_ERROR_COPY = {
  name: 'Enter your first and last name.',
  email: 'Enter a valid email address.',
  company: 'Check your company name.',
  phone: 'Check your phone number.',
  message: 'Check your message.',
  feature: 'Select what you want to join the waitlist for.',
  consent: 'Please accept the privacy notice.',
  turnstileToken: TOKEN_REQUIRED_MESSAGE,
};

/**
 * @param {string} id
 * @param {string | null} message
 */
export function setFieldError(id, message) {
  const field = document.getElementById(id);
  if (!(field instanceof HTMLElement)) return;

  const wrapper =
    field.closest('[data-lead-field]') ??
    field.closest('div.flex.w-full.flex-col') ??
    field.parentElement;
  const existing = document.getElementById(`${id}-error`);
  if (existing) existing.remove();

  field.removeAttribute('aria-invalid');
  const describedBy = field.getAttribute('aria-describedby') ?? '';
  const withoutError = describedBy
    .split(' ')
    .filter((token) => token && token !== `${id}-error`)
    .join(' ');
  if (withoutError) field.setAttribute('aria-describedby', withoutError);
  else field.removeAttribute('aria-describedby');

  const borderHost =
    field instanceof HTMLInputElement && field.type !== 'checkbox' && field.type !== 'radio'
      ? field.parentElement
      : field;
  borderHost?.classList.remove('border-status-error');

  if (!message || !wrapper) return;

  const errorId = `${id}-error`;
  field.setAttribute('aria-invalid', 'true');
  const nextDescribed = [withoutError, errorId].filter(Boolean).join(' ');
  field.setAttribute('aria-describedby', nextDescribed);
  borderHost?.classList.add('border-status-error');
  const error = document.createElement('p');
  error.id = errorId;
  error.className = 'm-0 text-caption text-status-error';
  error.setAttribute('role', 'alert');
  error.textContent = message;
  wrapper.appendChild(error);
}

/**
 * @param {HTMLFormElement} form
 */
function readValues(form) {
  const named = (name) => form.elements.namedItem(name);
  const text = (name) => {
    const field = named(name);
    return field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLSelectElement
      ? field.value
      : '';
  };
  const checked = (name) => {
    const field = named(name);
    return field instanceof HTMLInputElement ? field.checked : false;
  };

  return {
    name: text('name'),
    email: text('email'),
    company: text('company'),
    phone: text('phone'),
    message: text('message'),
    feature: text('feature'),
    website: text('website'),
    consent: checked('consent'),
    marketingOptIn: checked('marketingOptIn'),
  };
}

/**
 * Subject is UI-only (not in the lead schema). Fold it into `message`.
 * @param {string} [label]
 * @param {string} [message]
 * @returns {string}
 */
export function foldSubjectIntoMessage(label, message) {
  const text = typeof message === 'string' ? message.trim() : '';
  const prefixLabel = typeof label === 'string' ? label.trim() : '';
  if (!prefixLabel) return text;
  return `[${prefixLabel}]\n\n${text}`;
}

/**
 * @param {HTMLFormElement} form
 */
function composeContactMessage(form) {
  const messageField = form.elements.namedItem('message');
  const subjectField = form.elements.namedItem('subject');
  const message = messageField instanceof HTMLTextAreaElement ? messageField.value.trim() : '';
  if (!(subjectField instanceof HTMLSelectElement) || !subjectField.value) {
    return message;
  }
  const label = subjectField.selectedOptions[0]?.textContent?.trim() || subjectField.value;
  return foldSubjectIntoMessage(label, message);
}

/**
 * @param {string} prefix
 * @param {Record<string, string>} errors
 */
function applyErrors(prefix, errors) {
  const map = {
    name: `${prefix}-name`,
    email: `${prefix}-email`,
    company: `${prefix}-company`,
    phone: `${prefix}-phone`,
    message: `${prefix}-message`,
    feature: `${prefix}-feature`,
    consent: `${prefix}-consent`,
    turnstileToken: `${prefix}-turnstile`,
  };
  for (const [key, id] of Object.entries(map)) {
    setFieldError(id, errors[key] ?? null);
  }
}

/**
 * @param {string[]} fields
 * @returns {Record<string, string>}
 */
export function serverFieldsToErrors(fields) {
  /** @type {Record<string, string>} */
  const errors = {};
  for (const field of fields) {
    const key = field.split('.')[0];
    if (key && FIELD_ERROR_COPY[key]) {
      errors[key] = FIELD_ERROR_COPY[key];
    }
  }
  return errors;
}

/**
 * Request-level errors stay visible until the next submit. The validation
 * summary may hide once field errors are gone.
 * @param {boolean} requestErrorActive
 * @param {number} fieldErrorCount
 * @returns {boolean}
 */
export function shouldHideValidationSummary(requestErrorActive, fieldErrorCount) {
  return !requestErrorActive && fieldErrorCount === 0;
}

/**
 * @param {HTMLElement} el
 * @param {number} max
 */
function bindCharCount(el, max) {
  const count = document.getElementById(`${el.id}-count`);
  if (!count) return;
  const update = () => {
    const value = 'value' in el && typeof el.value === 'string' ? el.value : '';
    count.textContent = `${value.length}/${max}`;
  };
  el.addEventListener('input', update);
  update();
}

/**
 * @param {object} options
 * @param {HTMLFormElement} options.form
 * @param {string} options.formType
 * @param {string} options.siteKey
 * @param {string} [options.intakeUrl]
 * @param {string} [options.sourcePage]
 * @param {typeof fetch} [options.fetchImpl]
 */
export function bindLeadForm(options) {
  const form = options.form;
  const formType = options.formType === 'waitlist' ? 'waitlist' : 'contact';
  const prefix = formType;
  const formPanel = document.getElementById(`${prefix}-form-panel`);
  const successPanel = document.getElementById(`${prefix}-success`);
  const formError = document.getElementById(`${prefix}-form-error`);
  const formErrorText = document.getElementById(`${prefix}-form-error-text`);
  const resetRoot = document.getElementById(`${prefix}-reset`);
  const resetButton = resetRoot?.querySelector('button') ?? null;
  const submitButton = form.querySelector('button[type="submit"]');
  const idleLabel = submitButton?.textContent ?? 'Submit';
  const turnstileHost = document.getElementById(`${prefix}-turnstile`);
  const siteKey = options.siteKey ?? '';
  let attemptedSubmit = false;
  const touched = new Set();
  /** @type {Record<string, string>} */
  let serverFieldErrors = {};
  let submissionId = createSubmissionId();
  let turnstileToken = '';
  let turnstileWidgetId = null;
  let pending = false;
  let requestErrorActive = false;

  const fieldIds = [`${prefix}-name`, `${prefix}-email`, `${prefix}-consent`];
  if (formType === 'contact') {
    fieldIds.push(`${prefix}-subject`, `${prefix}-message`, `${prefix}-company`, `${prefix}-phone`);
  } else {
    fieldIds.push(`${prefix}-feature`, `${prefix}-company`);
  }

  function showFormError(message, { request = false } = {}) {
    requestErrorActive = request;
    if (formErrorText) formErrorText.textContent = message;
    formError?.classList.remove('hidden');
  }

  function hideFormError() {
    requestErrorActive = false;
    formError?.classList.add('hidden');
    if (formErrorText) formErrorText.textContent = VALIDATION_MESSAGE;
  }

  /**
   * Hide the validation summary when fields are clean. Request-level errors
   * (404/403/429/5xx/timeout) stay visible until the next submit.
   */
  function syncValidationFormError() {
    if (requestErrorActive || !attemptedSubmit) return;
    const fieldErrorCount = Object.keys({ ...currentErrors(), ...serverFieldErrors }).length;
    formError?.classList.toggle(
      'hidden',
      shouldHideValidationSummary(requestErrorActive, fieldErrorCount),
    );
  }

  function syncSubmitEnabled() {
    if (!(submitButton instanceof HTMLButtonElement)) return;
    const ready = Boolean(turnstileToken) && !pending;
    submitButton.disabled = !ready;
    submitButton.setAttribute('aria-busy', pending ? 'true' : 'false');
    submitButton.textContent = pending ? 'Sending…' : idleLabel;
  }

  function setPending(next) {
    pending = next;
    syncSubmitEnabled();
  }

  function currentErrors() {
    const values = readValues(form);
    const errors = validateLeadValues(formType, values);
    if (!turnstileToken) {
      errors.turnstileToken = TOKEN_REQUIRED_MESSAGE;
    }
    if (formType === 'contact') {
      const subject = form.elements.namedItem('subject');
      if (subject instanceof HTMLSelectElement && !subject.value) {
        errors.subject = 'Select a subject.';
      }
      if (composeContactMessage(form).length > LEAD_MESSAGE_MAX) {
        errors.message = 'Shorten your message so it fits with the subject.';
      }
    }
    return errors;
  }

  function visibleErrors() {
    const errors = { ...currentErrors(), ...serverFieldErrors };
    if (attemptedSubmit) return errors;
    /** @type {Record<string, string>} */
    const visible = {};
    for (const [key, message] of Object.entries(errors)) {
      const id = key === 'turnstileToken' ? `${prefix}-turnstile` : `${prefix}-${key}`;
      if (touched.has(id) || serverFieldErrors[key]) visible[key] = message;
    }
    return visible;
  }

  function paintErrors() {
    const errors = visibleErrors();
    applyErrors(prefix, errors);
    if (formType === 'contact') {
      setFieldError(`${prefix}-subject`, errors.subject ?? null);
    }
    return errors;
  }

  function clearErrors() {
    serverFieldErrors = {};
    applyErrors(prefix, {});
    if (formType === 'contact') setFieldError(`${prefix}-subject`, null);
    setFieldError(`${prefix}-turnstile`, null);
  }

  function resetTurnstile() {
    turnstileToken = '';
    const api = globalThis.turnstile;
    if (api && turnstileWidgetId != null) {
      api.reset(turnstileWidgetId);
    }
  }

  function renderTurnstile() {
    if (!turnstileHost) return;
    if (!siteKey) {
      setFieldError(`${prefix}-turnstile`, TOKEN_REQUIRED_MESSAGE);
      return;
    }
    const api = globalThis.turnstile;
    if (!api) return;
    turnstileHost.replaceChildren();
    turnstileWidgetId = api.render(turnstileHost, {
      sitekey: siteKey,
      callback: (token) => {
        turnstileToken = typeof token === 'string' ? token : '';
        if (turnstileToken && serverFieldErrors.turnstileToken) {
          const next = { ...serverFieldErrors };
          delete next.turnstileToken;
          serverFieldErrors = next;
        }
        paintErrors();
        syncSubmitEnabled();
        syncValidationFormError();
      },
      'expired-callback': () => {
        turnstileToken = '';
        setFieldError(`${prefix}-turnstile`, TOKEN_EXPIRED_MESSAGE);
        syncSubmitEnabled();
      },
      'error-callback': () => {
        turnstileToken = '';
        setFieldError(`${prefix}-turnstile`, TOKEN_ERROR_MESSAGE);
        syncSubmitEnabled();
      },
    });
  }

  function loadTurnstile() {
    if (!siteKey) {
      setFieldError(`${prefix}-turnstile`, TOKEN_REQUIRED_MESSAGE);
      return;
    }
    if (globalThis.turnstile) {
      renderTurnstile();
      return;
    }
    const existing = document.querySelector('script[data-lead-turnstile]');
    if (existing) {
      existing.addEventListener('load', renderTurnstile, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.leadTurnstile = 'true';
    script.addEventListener('load', renderTurnstile, { once: true });
    document.head.appendChild(script);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    attemptedSubmit = true;
    paintErrors();
    const blocking = Object.keys(currentErrors()).length > 0;
    formError?.classList.toggle('hidden', !blocking);
    if (blocking) {
      showFormError(VALIDATION_MESSAGE, { request: false });
      return;
    }
    if (pending) return;

    hideFormError();
    setPending(true);
    const values = readValues(form);
    const payload = buildLeadPayload({
      formType,
      submissionId,
      turnstileToken,
      sourcePage: options.sourcePage ?? stripBase(globalThis.location?.pathname ?? `/${formType}`),
      values: formType === 'contact' ? { ...values, message: composeContactMessage(form) } : values,
    });

    const result = await submitLead(payload, {
      fetchImpl: options.fetchImpl,
      url: options.intakeUrl,
    });

    if (result.ok) {
      formPanel?.classList.add('hidden');
      successPanel?.classList.remove('hidden');
      hideFormError();
      setPending(false);
      return;
    }

    if (result.kind === 'validation') {
      serverFieldErrors = {
        ...serverFieldErrors,
        ...serverFieldsToErrors(result.fields ?? []),
      };
      paintErrors();
      showFormError(result.message || VALIDATION_MESSAGE, { request: false });
    } else {
      showFormError(result.message || RETRY_MESSAGE, { request: true });
    }
    if (result.resetTurnstile) resetTurnstile();
    setPending(false);
  });

  for (const id of fieldIds) {
    const field = document.getElementById(id);
    if (!field) continue;
    const revalidate = () => {
      if (!attemptedSubmit && !touched.has(id)) return;
      const key = id.slice(prefix.length + 1);
      if (key && serverFieldErrors[key]) {
        const next = { ...serverFieldErrors };
        delete next[key];
        serverFieldErrors = next;
      }
      paintErrors();
      syncValidationFormError();
    };
    field.addEventListener('blur', () => {
      touched.add(id);
      revalidate();
    });
    field.addEventListener('input', revalidate);
    field.addEventListener('change', revalidate);
    const max = Number(field.getAttribute('maxlength') || '0');
    if (max > 0) bindCharCount(field, max);
  }

  resetButton?.addEventListener('click', () => {
    attemptedSubmit = false;
    touched.clear();
    form.reset();
    submissionId = createSubmissionId();
    clearErrors();
    hideFormError();
    successPanel?.classList.add('hidden');
    formPanel?.classList.remove('hidden');
    resetTurnstile();
    syncSubmitEnabled();
  });

  loadTurnstile();
}
