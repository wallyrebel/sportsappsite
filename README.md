# MississippiSportsApp.com

The official website for the **Mississippi Sports** app — driving iOS App Store downloads and showcasing aggregated sports news from across Mississippi.

**Live URL**: [mississippisportsapp.com](https://mississippisportsapp.com)  
**App Store**: [Mississippi Sports on iOS](https://apps.apple.com/us/app/mississippi-sports/id6758892239)

---

## Tech Stack

- **Astro 5** — Static-first framework with zero JS by default
- **Tailwind CSS v4** — Utility-first styling
- **TypeScript** — Type-safe throughout
- **Cloudflare Pages** — Free hosting with edge functions
- **Cloudflare R2** — Contact form file storage

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
├── public/               # Static assets (logo, images, robots.txt)
├── src/
│   ├── components/       # Astro components (Header, Hero, NewsCard, etc.)
│   ├── data/
│   │   ├── feeds.json    # RSS feed sources (admin-editable)
│   │   └── site.config.ts # Site-wide configuration
│   ├── layouts/          # Base HTML layout with SEO
│   ├── lib/
│   │   └── rss.ts        # Build-time RSS aggregation
│   ├── pages/
│   │   └── index.astro   # Homepage
│   └── styles/
│       └── global.css    # Design system + Tailwind
├── functions/
│   └── api/
│       └── contact.ts    # Contact form handler (Cloudflare Pages Function)
├── astro.config.mjs
└── package.json
```

## RSS Feed Management

Edit `src/data/feeds.json` to add or remove RSS sources:

```json
[
  {
    "name": "Display Name",
    "url": "https://example.com/feed",
    "label": "Source Label"
  }
]
```

After editing, rebuild the site (`npm run build` or push to Git).

## Cloudflare Pages Deployment

### Initial Setup

1. Push this repo to GitHub/GitLab
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
3. Create a new project → Connect to your Git repo
4. Configure build settings:
   - **Framework preset**: Astro
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Deploy

### Custom Domain

1. In Cloudflare Pages → your project → Custom domains
2. Add `mississippisportsapp.com`
3. If domain is on Cloudflare, DNS records are auto-configured
4. SSL is automatic

### R2 Bucket for Contact Form

1. Go to Cloudflare Dashboard → R2 → Create bucket (e.g., `ms-sports-contact`)
2. In Pages project → Settings → Functions → R2 bucket bindings
3. Add binding: Variable name = `CONTACT_BUCKET`, R2 bucket = your bucket
4. Redeploy

### Keeping Content Fresh

Set up a deploy hook to auto-rebuild (recommended every 30–60 min):

1. Pages project → Settings → Builds & deployments → Deploy hooks
2. Create hook → copy URL
3. Use a cron service (e.g., cron-job.org, free) to hit the URL on schedule

### Cloudflare Web Analytics

1. Cloudflare Dashboard → Web Analytics → Add site
2. Copy the beacon token
3. Update the `data-cf-beacon` token in `src/layouts/BaseLayout.astro`

## Environment Variables

Copy `.env.example` to `.env` for local development. In production, set variables in Cloudflare Pages → Settings → Environment variables.

## Future: Adding Android App Link

When ready to add a Google Play link:

1. Open `src/data/site.config.ts`
2. Add `playStore: { url: '...' }` to the `appStore` section
3. Search for `<!-- Future Android badge placeholder -->` in `Footer.astro`
4. Uncomment and update the Android CTA
5. Add Android badge to `HeroSection.astro` next to the iOS button

## SEO

The site includes:
- Apple Smart App Banner meta tag
- Organization + SoftwareApplication + NewsArticle schemas
- Open Graph + Twitter Card tags
- Auto-generated XML sitemap (`/sitemap-index.xml`)
- Optimized titles, descriptions, and keywords
- Canonical URLs

## License

© Mississippi Sports Group. All rights reserved.
