/** Resolve a public asset path against Vite's base (needed for GitHub Pages). */
export function assetUrl(path: string): string {
  const cleaned = path.replace(/^\/+/, '')
  const base = import.meta.env.BASE_URL
  return `${base}${cleaned}`
}
