/**
 * BIMI logo asset: SVG Tiny-PS / Portable-Secure (square, no external refs).
 *
 * Notes:
 * - BIMI receivers typically require the SVG to follow the "tiny-ps" subset.
 * - Keep this asset free of <script>, external <image>, and xlink:href-based
 *   references.
 */
export const BIMI_LOGO_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="64"
  height="64"
  viewBox="0 0 64 64"
  version="1.2"
  baseProfile="tiny-ps"
  preserveAspectRatio="xMidYMid meet"
>
  <title>Plattform Kit</title>
  <rect x="0" y="0" width="64" height="64" fill="#0B5BD3"/>
  <!-- Simple "P" mark (path-only to stay within Tiny-PS subset). -->
  <path
    d="M22 16h17c7.2 0 13 5.8 13 13s-5.8 13-13 13H32v-7h7c3.3 0 6-2.7 6-6s-2.7-6-6-6H29v26h-7V16z"
    fill="#FFFFFF"
  />
</svg>
`;
