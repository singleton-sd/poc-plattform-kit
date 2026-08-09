import type { IconName } from './icons';

export type FeatureItem = {
  title: string;
  description: string;
  icon?: IconName;
};

export type PricingTier = {
  name: string;
  price: string;
  priceYearly?: string;
  periodLabel?: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
  ctaVariant?: 'primary' | 'outline' | 'ghost';
};
