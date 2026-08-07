/* global document, window, getComputedStyle, MutationObserver, CSSRule */
/**
 * Remap Decap Emotion hardcoded blues to product --pk-* tokens.
 * Emotion hashes active-state class names, so CSS label selectors alone
 * cannot retint selection chrome; rewriting injected rules is required.
 */
(function remappedDecapTheme() {
  const BLUE = /#3a69c7|#e8f5fe|#eff0f4/gi;
  const RGB_BLUE = /rgba?\(\s*58\s*,\s*105\s*,\s*199(?:\s*,\s*[\d.]+)?\s*\)/gi;

  function productColors() {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    return {
      accent: cs.getPropertyValue('--pk-accent').trim() || '#fdc94a',
      accentBg: cs.getPropertyValue('--pk-accent-bg').trim() || '#6b4500',
      bg: cs.getPropertyValue('--pk-bg').trim() || '#292c30',
      surface: cs.getPropertyValue('--pk-surface').trim() || '#44484d',
    };
  }

  function replaceValue(value, colors) {
    return value
      .replace(BLUE, (match) => {
        const lower = match.toLowerCase();
        if (lower === '#3a69c7') return colors.accent;
        if (lower === '#e8f5fe') return colors.accentBg;
        if (lower === '#eff0f4') return colors.bg;
        return match;
      })
      .replace(RGB_BLUE, colors.accent);
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

  const observer = new MutationObserver(() => {
    window.clearTimeout(apply.timer);
    apply.timer = window.setTimeout(apply, 50);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      apply();
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  } else {
    apply();
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  window.setTimeout(apply, 500);
  window.setTimeout(apply, 2000);
})();
