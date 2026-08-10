import type { ReactElement, ReactNode } from 'react';

type ElementWithProps = ReactElement<Record<string, unknown>>;

function isReactElement(node: unknown): node is ElementWithProps {
  return (
    Boolean(node) && typeof node === 'object' && node !== null && 'type' in node && 'props' in node
  );
}

/** Depth-first search for the first rendered element matching `type` (e.g. 'input', 'select'). */
export function findByType(node: ReactNode, type: string): ElementWithProps | undefined {
  if (!isReactElement(node)) return undefined;
  if (node.type === type) return node;

  const children = node.props.children;
  const candidates = Array.isArray(children) ? children : [children];
  for (const child of candidates) {
    const match = findByType(child as ReactNode, type);
    if (match) return match;
  }
  return undefined;
}
