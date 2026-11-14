/* global window, document, CMS, createClass, h, MutationObserver */
/**
 * Official Decap preview customization:
 * https://decapcms.org/docs/customization/
 *
 * Mirrors live templates:
 * - home → apps/marketing/src/pages/index.astro
 * - other slugs → apps/marketing/src/pages/[slug].astro
 * description is SEO-only (BaseLayout meta), never page body.
 */
(function registerAdminPreview() {
  if (!window.CMS) return;

  CMS.registerPreviewStyle('/admin/preview.css');

  /**
   * Token CSS is gated on [data-theme='dark']. Decap preview iframes omit it,
   * so stamp the attribute whenever a preview frame mounts.
   */
  function stampPreviewTheme() {
    const frames = document.querySelectorAll('iframe');
    for (let i = 0; i < frames.length; i += 1) {
      try {
        const root = frames[i].contentDocument && frames[i].contentDocument.documentElement;
        if (root && root.getAttribute('data-theme') !== 'dark') {
          root.setAttribute('data-theme', 'dark');
        }
      } catch {
        /* ignore cross-origin */
      }
    }
  }

  const previewObserver = new MutationObserver(stampPreviewTheme);
  previewObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(stampPreviewTheme, 0);
  window.setTimeout(stampPreviewTheme, 500);
  window.setTimeout(stampPreviewTheme, 2000);

  const PagesPreview = createClass({
    render: function renderPagesPreview() {
      const entry = this.props.entry;
      const slug = entry.get('slug');
      const brand = entry.getIn(['data', 'brand']);
      const headline = entry.getIn(['data', 'headline']);
      const ctaLabel = entry.getIn(['data', 'ctaLabel']);
      const ctaUrl = entry.getIn(['data', 'ctaUrl']);
      const title = entry.getIn(['data', 'title']);
      const updated = entry.getIn(['data', 'updated']);
      const body = this.props.widgetFor('body');

      // Match getStaticPaths filter: home uses index.astro, everything else [slug].astro
      if (slug === 'home') {
        return h(
          'div',
          { className: 'pk-preview pk-preview--home' },
          brand
            ? h(
                'p',
                { className: 'pk-preview__brand' },
                brand,
                h('span', { className: 'pk-preview__dot' }, '.'),
              )
            : null,
          headline ? h('h1', { className: 'pk-preview__headline' }, headline) : null,
          h('div', { className: 'pk-preview__body' }, body),
          ctaLabel && ctaUrl
            ? h('a', { className: 'pk-preview__cta', href: ctaUrl }, ctaLabel)
            : null,
        );
      }

      return h(
        'div',
        { className: 'pk-preview pk-preview--page' },
        h('a', { className: 'pk-preview__back', href: '/' }, '← Back to Platform Kit'),
        h(
          'article',
          { className: 'pk-preview__article' },
          title ? h('h1', { className: 'pk-preview__title' }, title) : null,
          updated ? h('p', { className: 'pk-preview__updated' }, 'Last updated: ', updated) : null,
          h('div', { className: 'pk-preview__body' }, body),
        ),
      );
    },
  });

  CMS.registerPreviewTemplate('pages', PagesPreview);
})();
