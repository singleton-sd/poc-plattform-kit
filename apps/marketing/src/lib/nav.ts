export type NavLink = {
  label: string;
  href: string;
};

/** Primary destinations from the Figma shell (pages land in follow-up tickets). */
export const primaryNav: NavLink[] = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export const footerColumns: { title: string; links: NavLink[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
  {
    title: 'Connect',
    links: [{ label: 'GitHub', href: 'https://github.com/singleton-sd/poc-plattform-kit' }],
  },
];

export const appCta = {
  label: 'Get started',
  href: 'https://app.plattform-kit.poc.singletonsd.com',
};
