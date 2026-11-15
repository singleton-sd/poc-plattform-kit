import { render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { formatWizardDocumentTitle, useWizardStepHeading } from './use-wizard-step-heading';

function Probe({ step, template }: { step: string; template: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useWizardStepHeading({ stepLabel: step, titleTemplate: template, headingRef });
  return <h1 ref={headingRef}>{step}</h1>;
}

describe('useWizardStepHeading', () => {
  it('formats the document title from the supplied template', () => {
    expect(formatWizardDocumentTitle('Terms', '{Step} — Prepare contract — Acme')).toBe(
      'Terms — Prepare contract — Acme',
    );
  });

  it('focuses the step h1, sets title, and applies scroll-padding', async () => {
    render(<Probe step="Terms" template="{Step} — Prepare contract — LeaseMate" />);
    const heading = screen.getByRole('heading', { level: 1, name: 'Terms' });
    await waitFor(() => {
      expect(document.title).toBe('Terms — Prepare contract — LeaseMate');
      expect(heading).toHaveFocus();
    });
    expect(document.documentElement.style.scrollPaddingTop).toBe('4.75rem');
    expect(document.documentElement.style.scrollPaddingBottom).toBe('5.5rem');
  });
});
