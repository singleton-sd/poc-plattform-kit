'use client';

import { useEffect, type RefObject } from 'react';
import { WIZARD_FOOTER_HEIGHT } from './sticky-action-footer';
import { WIZARD_HEADER_HEIGHT } from './wizard-header';

export function formatWizardDocumentTitle(stepLabel: string, titleTemplate: string): string {
  return titleTemplate.replaceAll('{step}', stepLabel).replaceAll('{Step}', stepLabel);
}

export function applyWizardScrollPadding(target: HTMLElement): void {
  target.style.scrollPaddingTop = WIZARD_HEADER_HEIGHT;
  target.style.scrollPaddingBottom = WIZARD_FOOTER_HEIGHT;
}

export type UseWizardStepHeadingOptions = {
  stepLabel: string;
  titleTemplate: string;
  headingRef: RefObject<HTMLElement | null>;
};

export function useWizardStepHeading({
  stepLabel,
  titleTemplate,
  headingRef,
}: UseWizardStepHeadingOptions): void {
  useEffect(() => {
    applyWizardScrollPadding(document.documentElement);
    document.title = formatWizardDocumentTitle(stepLabel, titleTemplate);
    const heading = headingRef.current;
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
    return () => {
      document.documentElement.style.scrollPaddingTop = '';
      document.documentElement.style.scrollPaddingBottom = '';
    };
  }, [headingRef, stepLabel, titleTemplate]);
}
