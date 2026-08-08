/* global window, CMS, createClass, h */
/**
 * Official Decap preview customization:
 * https://decapcms.org/docs/customization/
 */
(function registerAdminPreview() {
  if (!window.CMS) return;

  CMS.registerPreviewStyle('/admin/preview.css');

  const PagesPreview = createClass({
    render: function renderPagesPreview() {
      const entry = this.props.entry;
      const brand = entry.getIn(['data', 'brand']);
      const headline = entry.getIn(['data', 'headline']);
      const ctaLabel = entry.getIn(['data', 'ctaLabel']);
      const ctaUrl = entry.getIn(['data', 'ctaUrl']);
      const title = entry.getIn(['data', 'title']);
      const description = entry.getIn(['data', 'description']);
      const updated = entry.getIn(['data', 'updated']);

      return h(
        'div',
        { className: 'pk-preview' },
        brand
          ? h(
              'p',
              { className: 'pk-preview__brand' },
              brand,
              h('span', { className: 'pk-preview__dot' }, '.'),
            )
          : null,
        headline ? h('h1', { className: 'pk-preview__headline' }, headline) : null,
        !brand && !headline && title ? h('h1', { className: 'pk-preview__headline' }, title) : null,
        description ? h('p', { className: 'pk-preview__description' }, description) : null,
        h('div', { className: 'pk-preview__body' }, this.props.widgetFor('body')),
        ctaLabel && ctaUrl
          ? h('a', { className: 'pk-preview__cta', href: ctaUrl }, ctaLabel)
          : null,
        updated ? h('p', { className: 'pk-preview__updated' }, 'Updated ', updated) : null,
      );
    },
  });

  CMS.registerPreviewTemplate('pages', PagesPreview);
})();
