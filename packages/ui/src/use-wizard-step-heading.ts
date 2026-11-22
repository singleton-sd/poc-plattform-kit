'use client';

import { useEffect, type RefObject } from 'react';
import { WIZARD_FOOTER_HEIGHT } from './sticky-action-footer';
import { WIZARD_HEADER_HEIGHT } from './wizard-header';

export function formatWizardDocumentTitle(stepLabel: string, titleTemplate: string): string {
  return titleTemplate.replaceAll('{step}', stepLabel).replaceAll('{Step}', stepLabel);
}

function fallbackPx(fallback: string): number {
  const n = parseFloat(fallback);
  if (fallback.endsWith('rem')) {
    const rootSize =
      typeof document === 'undefined'
        ? 16
        : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return n * rootSize;
  }
  return n;
}

function chromeScrollPadding(measuredPx: number, fallback: string): string {
  return measuredPx > fallbackPx(fallback) ? `${measuredPx}px` : fallback;
}

export function applyWizardScrollPadding(
  target: HTMLElement,
  header?: HTMLElement | null,
  footer?: HTMLElement | null,
): void {
  target.style.scrollPaddingTop = chromeScrollPadding(
    header?.getBoundingClientRect().height ?? 0,
    WIZARD_HEADER_HEIGHT,
  );
  target.style.scrollPaddingBottom = chromeScrollPadding(
    footer?.getBoundingClientRect().height ?? 0,
    WIZARD_FOOTER_HEIGHT,
  );
}

export type UseWizardStepHeadingOptions = {
  stepLabel: string;
  titleTemplate: string;
  headingRef: RefObject<HTMLElement | null>;
};

function wizardChrome(): { header: HTMLElement | null; footer: HTMLElement | null } {
  return {
    header: document.querySelector<HTMLElement>('[data-kit-ui="wizard-header"]'),
    footer: document.querySelector<HTMLElement>('[data-kit-ui="wizard-footer"]'),
  };
}

export function useWizardStepHeading({
  stepLabel,
  titleTemplate,
  headingRef,
}: UseWizardStepHeadingOptions): void {
  useEffect(() => {
    const root = document.documentElement;
    const previousTop = root.style.scrollPaddingTop;
    const previousBottom = root.style.scrollPaddingBottom;
    const apply = () => {
      const { header, footer } = wizardChrome();
      applyWizardScrollPadding(root, header, footer);
    };
    apply();

    const { header, footer } = wizardChrome();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    if (header) observer?.observe(header);
    if (footer) observer?.observe(footer);

    return () => {
      observer?.disconnect();
      root.style.scrollPaddingTop = previousTop;
      root.style.scrollPaddingBottom = previousBottom;
    };
  }, []);

  useEffect(() => {
    const { header, footer } = wizardChrome();
    applyWizardScrollPadding(document.documentElement, header, footer);
    document.title = formatWizardDocumentTitle(stepLabel, titleTemplate);
    const heading = headingRef.current;
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [headingRef, stepLabel, titleTemplate]);
}
