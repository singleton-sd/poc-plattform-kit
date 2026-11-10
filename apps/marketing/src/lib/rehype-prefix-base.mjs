import { isAbsoluteUrl, normalizeBase, withBase } from './with-base.mjs';

/**
 * Prefix site-relative href/src on Markdown HTML so CMS copy like
 * `[Privacy Policy](/privacy)` works under GitHub Pages PR preview bases.
 *
 * @param {{ base?: string }} [options]
 */
export function rehypePrefixBase(options = {}) {
  const base = normalizeBase(options.base ?? '/');

  /**
   * @param {unknown} value
   * @returns {unknown}
   */
  function rewrite(value) {
    if (typeof value !== 'string' || value.length === 0) return value;
    if (isAbsoluteUrl(value) || value.startsWith('#') || !value.startsWith('/')) {
      return value;
    }
    return withBase(value, base);
  }

  /**
   * @param {unknown} node
   */
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    const element =
      /** @type {{ type?: string, tagName?: string, properties?: Record<string, unknown>, children?: unknown[] }} */ (
        node
      );
    if (element.type === 'element' && element.properties) {
      if ('href' in element.properties) {
        element.properties.href = rewrite(element.properties.href);
      }
      if ('src' in element.properties) {
        element.properties.src = rewrite(element.properties.src);
      }
    }
    for (const child of element.children ?? []) {
      walk(child);
    }
  }

  return (tree) => {
    walk(tree);
  };
}
