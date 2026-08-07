type BrandMarkProps = {
  /** Visual size — login hero vs compact shell header. */
  size?: 'hero' | 'header';
  className?: string;
};

const sizeClass = {
  hero: 'text-[clamp(2.25rem,7vw,3.5rem)] font-bold leading-none tracking-tight',
  header: 'text-xl font-bold leading-none tracking-tight',
} as const;

/** Shared product wordmark — matches marketing `Platform Kit.` treatment. */
export function BrandMark({ size = 'header', className = '' }: BrandMarkProps) {
  return (
    <p
      className={`font-heading text-fg ${sizeClass[size]} ${className}`.trim()}
      data-testid="brand-mark"
    >
      Platform Kit<span className="text-accent">.</span>
    </p>
  );
}
