# Desha News

A Sinhala-first, responsive news publication built with **Next.js App Router, TypeScript, and React**. The red, ivory, and gold identity follows the supplied Desha News logo.

## Development

Requires Node.js 20.9+ and pnpm.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. `pnpm build` creates a static production website in `out/`, suitable for static hosting. `pnpm typecheck` checks TypeScript.

## Included

- Responsive homepage, category navigation, Sinhala text search, manually navigable headline ticker.
- Eight individually addressable article pages with metadata and related stories.
- Bookmarks persisted in this browser's localStorage, and a copy-link sharing button.
- Mobile navigation, accessible control labels, keyboard focus styles, reduced motion support, and a 404 page.
- Original user-provided logo in `public/images/desha-logo.jpeg`.

## Content and launch

Edit articles in `src/lib/articles.ts`. These are clearly labeled **sample articles**, not a live news feed. The date displayed on the preview is 12 October 2026. Replace sample text and dates with verified editorial content before a public launch.

This is a frontend/static publication; there is no admin panel, CMS, authentication, newsletter backend, or Facebook integration. The user's 11K audience is represented without inventing a Facebook page URL. Add the confirmed official URL to the community area when available. Preview robots metadata is set to noindex; change it when real content is ready.

## Images

The logo is supplied by the user. Preview photography sources:

- Ella: https://www.lankavillas.com/dutch-house-bandarawela/experiences/nine-arches-bridge.html
- Colombo: https://www.goway.com/destinations/indian-ocean/sri-lanka/places/colombo
- Remaining illustrative photos: Unsplash images photo-1540747913346-19e32dc3e97e, photo-1518770660439-4636190af475, photo-1472396961693-142e6e269027, photo-1503676260728-1c00da094a0b, photo-1486406146926-c627a92ad1ab.

Use owned or licensed editorial images for public launch. Noto Sans Sinhala and Manrope are loaded through Google Fonts, with system fallbacks.
