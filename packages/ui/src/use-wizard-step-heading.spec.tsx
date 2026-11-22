import { render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { WIZARD_FOOTER_HEIGHT } from './sticky-action-footer';
import { WIZARD_HEADER_HEIGHT } from './wizard-header';
import {
  applyWizardScrollPadding,
  formatWizardDocumentTitle,
  useWizardStepHeading,
} from './use-wizard-step-heading';

function Probe({ step, template }: { step: string; template: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useWizardStepHeading({ stepLabel: step, titleTemplate: template, headingRef });
  return <h1 ref={headingRef}>{step}</h1>;
}

function mockRect(el: HTMLElement, height: number) {
  jest.spyOn(el, 'getBoundingClientRect').mockReturnValue({ height } as DOMRect);
}

describe('useWizardStepHeading', () => {
  afterEach(() => {
    document.documentElement.style.scrollPaddingTop = '';
    document.documentElement.style.scrollPaddingBottom = '';
    jest.restoreAllMocks();
  });

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
    expect(document.documentElement.style.scrollPaddingTop).toBe(WIZARD_HEADER_HEIGHT);
    expect(document.documentElement.style.scrollPaddingBottom).toBe(WIZARD_FOOTER_HEIGHT);
  });

  it('updates title and heading focus when the step changes', async () => {
    const { rerender } = render(
      <Probe step="Terms" template="{Step} — Prepare contract — LeaseMate" />,
    );
    await waitFor(() => {
      expect(document.title).toBe('Terms — Prepare contract — LeaseMate');
    });
    const other = document.createElement('button');
    document.body.appendChild(other);
    other.focus();
    expect(other).toHaveFocus();

    rerender(<Probe step="Review" template="{Step} — Prepare contract — LeaseMate" />);
    await waitFor(() => {
      expect(document.title).toBe('Review — Prepare contract — LeaseMate');
      expect(screen.getByRole('heading', { level: 1, name: 'Review' })).toHaveFocus();
    });
    other.remove();
  });

  it('restores prior root scroll-padding on unmount', () => {
    const root = document.documentElement;
    root.style.scrollPaddingTop = '1rem';
    root.style.scrollPaddingBottom = '2rem';
    const { unmount } = render(
      <Probe step="Terms" template="{Step} — Prepare contract — LeaseMate" />,
    );
    unmount();
    expect(root.style.scrollPaddingTop).toBe('1rem');
    expect(root.style.scrollPaddingBottom).toBe('2rem');
  });

  it('uses measured header and footer heights when they wrap past the minimum', () => {
    const target = document.createElement('div');
    const header = document.createElement('header');
    const footer = document.createElement('footer');
    mockRect(header, 120);
    mockRect(footer, 140);
    applyWizardScrollPadding(target, header, footer);
    expect(target.style.scrollPaddingTop).toBe('120px');
    expect(target.style.scrollPaddingBottom).toBe('140px');
  });

  it('measures wrapped chrome already in the document', () => {
    const header = document.createElement('header');
    header.setAttribute('data-kit-ui', 'wizard-header');
    const footer = document.createElement('footer');
    footer.setAttribute('data-kit-ui', 'wizard-footer');
    mockRect(header, 120);
    mockRect(footer, 140);
    document.body.append(header, footer);
    render(<Probe step="Terms" template="{Step} — Prepare contract — LeaseMate" />);
    expect(document.documentElement.style.scrollPaddingTop).toBe('120px');
    expect(document.documentElement.style.scrollPaddingBottom).toBe('140px');
    header.remove();
    footer.remove();
  });
});
