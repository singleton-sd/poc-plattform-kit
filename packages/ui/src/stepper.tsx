import { CheckIcon } from './icons';

export type WizardStep = {
  id: string;
  label: string;
  href?: string;
};

export type StepperProps = {
  steps: WizardStep[];
  currentIndex: number;
  navAriaLabel?: string;
};

export type StepState = 'completed' | 'current' | 'not started';

export function stepState(index: number, currentIndex: number): StepState {
  if (index < currentIndex) return 'completed';
  if (index === currentIndex) return 'current';
  return 'not started';
}

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const TARGET = 'inline-flex min-h-11 min-w-11 items-center gap-2 text-sm text-fg';

function Marker({ state }: { state: StepState }) {
  if (state === 'completed') return <CheckIcon className="h-4 w-4 text-fg" />;
  if (state === 'current') {
    return <span className="h-2.5 w-2.5 rounded-full bg-fg" aria-hidden="true" />;
  }
  return <span className="h-2.5 w-2.5 rounded-full border-2 border-fg bg-bg" aria-hidden="true" />;
}

export function Stepper({ steps, currentIndex, navAriaLabel = 'Contract steps' }: StepperProps) {
  const current = steps[currentIndex];
  const ratio = steps.length === 0 ? 0 : ((currentIndex + 1) / steps.length) * 100;

  return (
    <div>
      <nav aria-label={navAriaLabel} className="hidden sm:block">
        <ol className="flex flex-wrap items-center gap-1">
          {steps.map((step, index) => {
            const state = stepState(index, currentIndex);
            const body = (
              <>
                <Marker state={state} />
                <span>{step.label}</span>
                <span className="sr-only">{state}</span>
              </>
            );
            const isLink = state === 'completed' && Boolean(step.href);
            return (
              <li key={step.id} className="flex min-w-0 items-center gap-1">
                {index > 0 ? (
                  <span
                    className="h-px w-4 shrink-0 bg-fg"
                    aria-hidden="true"
                    data-testid="step-connector"
                  />
                ) : null}
                {isLink ? (
                  <a href={step.href} className={`${TARGET} ${FOCUS}`}>
                    {body}
                  </a>
                ) : (
                  <span
                    className={TARGET}
                    {...(state === 'current' ? { 'aria-current': 'step' as const } : {})}
                  >
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {current ? (
        <div className="min-w-0 sm:hidden">
          <p className="text-sm text-fg">
            Step {currentIndex + 1} of {steps.length} · {current.label}
          </p>
          <div
            aria-hidden="true"
            className="mt-2 h-1 w-full bg-bg-subtle"
            data-testid="step-progress"
          >
            <div className="h-1 bg-fg" style={{ width: `${ratio}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
