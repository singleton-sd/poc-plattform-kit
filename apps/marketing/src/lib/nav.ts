export type NavLink = {
  label: string;
  href: string;
};

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
      { label: 'Docs', href: '/docs' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Blog', href: '/blog' },
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
    links: [
      { label: 'GitHub', href: 'https://github.com/singleton-sd/poc-plattform-kit' },
      { label: 'Twitter', href: 'https://twitter.com' },
    ],
  },
];

export const appCta = {
  label: 'Get started',
  href: 'https://app.plattform-kit.poc.singletonsd.com',
};
