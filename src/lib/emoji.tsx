/**
 * Global utility for rendering Twemoji on the Car Thing.
 *
 * The Car Thing runs an old Chromium (v69) on a stripped-down Linux that's
 * missing modern emoji glyphs (heart-hands, melting face, anything Unicode 14+
 * basically), so the system font draws them as tofu boxes. We swap those code
 * points out for Twemoji SVG `<img>` tags before rendering.
 *
 * The SVGs themselves live on jsDelivr, which the Car Thing can't reach
 * directly (no public internet on the device — only the LAN to the PC running
 * DeskThing). We route every asset URL through DeskThing's built-in
 * `useProxy` so the PC fetches the SVG and serves it back over the local
 * connection.
 */

import { DeskThing } from '@deskthing/client'

declare const twemoji: any

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/npm/@twemoji/api@latest/assets/'

/**
 * Twemoji `parse` accepts a `callback(icon, options)` that returns the URL for
 * each replaced glyph. We intercept it to wrap the URL in `DeskThing.useProxy`
 * — on Car Thing this routes through the PC; in dev (browser) `useProxy` is a
 * no-op so the CDN URL is used as-is.
 */
function buildAssetUrl(icon: string, options: any): string {
  const folder = options.folder || 'svg'
  const ext = options.ext || '.svg'
  const base = options.base || TWEMOJI_BASE
  const original = `${base}${folder}/${icon}${ext}`
  try {
    const proxied = DeskThing.useProxy(original)
    return proxied || original
  } catch {
    return original
  }
}

export function Emoji({ text, className }: { text: string; className?: string }) {
  if (typeof twemoji === 'undefined') {
    return <span className={className}>{text}</span>
  }

  const html = twemoji.parse(text, {
    folder: 'svg',
    ext: '.svg',
    base: TWEMOJI_BASE,
    callback: (icon: string, options: any) => buildAssetUrl(icon, options),
    className: 'emoji'
  })

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
