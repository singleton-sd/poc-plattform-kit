/* global document, window, getComputedStyle, MutationObserver, CSSRule */
/**
 * Unofficial Emotion stylesheet rewriter for Decap admin chrome.
 *
 * Decap inlines hex from packages/decap-cms-ui-default/src/styles.js
 * (colorsRaw). There is no public theme API (issue #1727); CSS overrides
 * alone cannot always win against Emotion. This remaps colorsRaw accents /
 * backgrounds / status colors to product --pk-* tokens after styles mount.
 *
 * Pure white/black are intentionally NOT remapped — they appear as both
 * text and surfaces; admin.css owns those via solid product surfaces.
 *
 * Requires a pinned Decap CDN version (see admin/index.html).
 */
(function remappedDecapTheme() {
  /** colorsRaw (+ common leftovers) → product role */
  const HEX_TO_ROLE = {
    '#eff0f4': 'bg', // grayLight — page / inactive wash
    '#798291': 'muted', // gray
    '#3a69c7': 'accent', // blue → product accent
    '#e8f5fe': 'accentBg', // blueLight
    '#005614': 'success',
    '#caef6f': 'successBg',
    '#754e00': 'warn',
    '#ffee9c': 'warnBg',
    '#ff003b': 'danger',
    '#d60032': 'danger',
    '#fcefea': 'dangerBg',
    '#70399f': 'info',
    '#f6d8ff': 'accentBg',
    '#17a2b8': 'accent', // teal primary CTAs
    '#117888': 'accent',
    '#ddf5f9': 'accentBg',
    '#dfdfe3': 'border',
    '#5d626f': 'muted',
    '#aae31f': 'successBg',
    '#1195aa': 'accent',
    '#eaebf1': 'border',
    '#fbe0d7': 'dangerBg',
  };

  const RGB_BLUE = /rgba?\(\s*58\s*,\s*105\s*,\s*199(?:\s*,\s*([\d.]+))?\s*\)/gi;
  const RGB_GRAY_LIGHT = /rgba?\(\s*239\s*,\s*240\s*,\s*244(?:\s*,\s*([\d.]+))?\s*\)/gi;
  const HEX = /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi;

  function productColors() {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const get = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    return {
      accent: get('--pk-accent', 'var(--colors-yellow-light-400)'),
      accentBg: get('--pk-accent-bg', 'var(--colors-yellow-light-900)'),
      bg: get('--pk-bg', 'var(--colors-gray-900)'),
      surface: get('--pk-surface', 'var(--colors-gray-800)'),
      surfaceRaised: get('--pk-surface-raised', 'var(--colors-gray-700)'),
      fg: get('--pk-fg', 'var(--colors-gray-100)'),
      muted: get('--pk-muted', 'var(--colors-gray-400)'),
      border: get('--pk-border', 'var(--colors-gray-700)'),
      danger: get('--pk-danger', 'var(--colors-red-400)'),
      dangerBg: get('--pk-danger-bg', 'var(--colors-red-900)'),
      success: get('--pk-success', 'var(--colors-green-400)'),
      successBg: get('--pk-success-bg', 'var(--colors-green-900)'),
      warn: get('--pk-warn', 'var(--colors-yellow-light-300)'),
      warnBg: get('--pk-warn-bg', 'var(--colors-yellow-light-900)'),
      info: get('--pk-info', 'var(--colors-yellow-light-400)'),
    };
  }

  function withAlpha(color, alpha) {
    if (alpha === undefined || alpha === '' || Number(alpha) >= 1) {
      return color;
    }
    const pct = Math.round(Number(alpha) * 100);
    return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
  }

  function mapHex(hex, colors) {
    const key = HEX_TO_ROLE[hex.toLowerCase()];
    return key ? colors[key] || hex : null;
  }

  function replaceValue(value, colors) {
    let next = value.replace(HEX, (match) => {
      const mapped = mapHex(match, colors);
      return mapped || match;
    });
    next = next.replace(RGB_BLUE, (_match, alpha) => withAlpha(colors.accent, alpha));
    next = next.replace(RGB_GRAY_LIGHT, (_match, alpha) => withAlpha(colors.bg, alpha));
    return next;
  }

  function rewriteSheet(sheet, colors) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      return;
    }
    if (!rules) return;

    for (let i = 0; i < rules.length; i += 1) {
      const rule = rules[i];
      if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE) {
        rewriteSheet(rule, colors);
        continue;
      }
      if (!rule.style) continue;

      for (let j = 0; j < rule.style.length; j += 1) {
        const prop = rule.style.item(j);
        const raw = rule.style.getPropertyValue(prop);
        if (!raw || (!raw.includes('#') && !raw.includes('rgb'))) continue;
        const next = replaceValue(raw, colors);
        if (next !== raw) {
          rule.style.setProperty(prop, next, rule.style.getPropertyPriority(prop));
        }
      }
    }
  }

  function apply() {
    const colors = productColors();
    for (const sheet of Array.from(document.styleSheets)) {
      rewriteSheet(sheet, colors);
    }
  }

  function scheduleApply() {
    window.clearTimeout(apply.timer);
    apply.timer = window.setTimeout(apply, 50);
  }

  const observer = new MutationObserver(scheduleApply);

  function start() {
    apply();
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    window.addEventListener('hashchange', scheduleApply);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.setTimeout(apply, 500);
  window.setTimeout(apply, 2000);
})();
