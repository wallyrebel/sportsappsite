# Mississippi high-school scoreboard

The embed builder is `/scoreboard/`. Its ticker is `/scoreboard/embed?group=statewide`. The same collected scores enrich `/api/broadcast`, so the existing `/broadcast` display can rotate high-school games in progress, finals, and upcoming games alongside its other programming.

## Embeds

Paste this into a WordPress Custom HTML block or custom site's HTML:

```html
<iframe src="https://mississippisportsapp.com/scoreboard/embed?group=statewide"
  title="Mississippi high-school scores" width="100%" height="144"
  style="border:0;display:block" loading="eager"></iframe>
```

The public URL must be deployed before this works. No WordPress plugin or script permission is needed beyond allowing an iframe in the HTML block.

For vMix, add a Web Browser input at 1920 × 1080:

```text
https://mississippisportsapp.com/scoreboard/embed?group=statewide&mode=vmix
```

The ticker is positioned at the bottom of a transparent canvas. Add it to an overlay channel over your video. It does not modify the video stream by itself.

Parameters:

| Parameter | Values |
| --- | --- |
| `group` | `statewide`, `tippah`, `alcorn`, `custom` |
| `teams` | Comma-separated school names for `group=custom` |
| `days` | `1` (today; default), `8` (today + next seven days) |
| `date` | Optional fixed YYYY-MM-DD; omit for automatic Central-time date rollover |
| `sport` | `all`, or a key from `scoreboard/public/shared.mjs` |
| `status` | `all`, `scheduled`, `live`, `final` |
| `theme` | `dark` or `light` |
| `speed` | Pixels per second; default 45 |
| `mode` | `vmix` enables the transparent 1920 × 1080 layout |
| `title` | Optional custom label |

Tippah includes Ripley, Falkner, Walnut, Pine Grove, and Blue Mountain. Alcorn includes Alcorn Central, Biggersville, Corinth, and Kossuth. These presets are public high-school school lists, not a claim to include every private/youth/college team in a county. Either participating school can match, and all collected sports remain eligible. Extend `GROUPS` or use the builder's Custom option for additional teams.

## Automatic collection

Cloudflare's previous direct MaxPreps collector returned HTTP 403. The new architecture separates collection from serving: a Node collector runs in GitHub Actions and publishes a `scoreboard.json` snapshot on the `scoreboard-data` branch. Cloudflare serves that snapshot through the API; browsers check the API every 60 seconds. No browser needs to remain open to run scheduled collection.

The workflow targets every five minutes, offset from the top of the hour. GitHub may delay scheduled jobs; this is not a real-time service guarantee. GitHub schedules activate only after the workflow reaches the default branch. The initial push and manual dispatch can verify collection before that. A successful local run does not establish that the hosted job has upstream access: verify the Actions run and advancing source timestamps before relying on unattended updates.

Today is refreshed each run. Tomorrow through day seven is refreshed every six hours, and yesterday every 30 minutes for late results. Unavailable routes returning 404 are backed off for 12 hours. The publisher writes source errors even when collection fails, exits unsuccessfully when no current source works, and retains usable prior data only within its expiry. Data commits begin `[CF-Pages-Skip]` to avoid unnecessary Pages builds. The public workflow uses only its repository-scoped `GITHUB_TOKEN` and no external secrets.

The source-health panel exposes every sport's last successful check. Today's data becomes delayed after 15 minutes without a successful source check. Live scores disappear after one hour; old scheduled entries stop appearing as upcoming after the Central-time day ends. A score of zero remains zero; unknown scores remain dashes. A game is live only when the source explicitly says so. Provider records are not confused with game scores.

## Coverage and the linked MCP project

The adapter reads the public Mississippi scoreboards at MaxPreps. It covers available varsity head-to-head games across sports, not just football. Nine currently compatible categories are baseball, boys/girls basketball, football, girls flag football, boys/girls soccer, softball, and volleyball. Other configured sport routes are checked and their unavailable formats are shown. Meet-based sports and unreported games are coverage gaps. Schools and scorekeepers control how promptly scores are submitted; polling cannot create an unreported live score.

The [maxpreps-mcp project](https://github.com/chrischall/maxpreps-mcp) helps discover schools and per-team schedules. Its documented JSON approach does not supply a statewide scoreboard. Its published schedule decoder also does not expose every live-score field. This package therefore uses an independently written statewide HTML adapter; the MCP server and an AI subscription are not runtime requirements. It can be added later for verified school identifiers or additional team-specific schedules.

## Deploy and verify

1. `npm ci`, `npm run test:scoreboard`, `npm run test:broadcast`, `npm run build`.
2. Push the code and check **Refresh high school scores** in GitHub Actions. Confirm a successful current source check, not merely a JSON file's existence.
3. Deploy the site through its existing Cloudflare Pages Git integration. The build copies portable assets into `public/scoreboard/`.
4. Check `/scoreboard/api/scores`, `/scoreboard/`, and `/api/broadcast`. Confirm game dates, scores, and advancing `checkedAt` timestamps.
5. Merge to the default branch to enable the five-minute schedule. Scheduled workflow delays or provider access failures remain visible in the source-health panel.

An optional standalone Worker uses `npm run deploy:scoreboard` and serves the same interface at its own root. The Pages route and Worker share the feed reader. No new database or paid service is provisioned.

For the separate watch player, embed the same iframe on its webpage. If the ticker is already part of the live video, update the production browser input or deploy this repository's `/broadcast` integration; the player cannot edit graphics already baked into HLS video.

The main site's existing news, sponsor, audio, college, JUCO, and official association sources remain available. Conflicting cross-source finals use the existing withholding rule.

References: [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Cloudflare build skipping](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/#skipping-builds-via-commit-messages), [MaxPreps Mississippi](https://www.maxpreps.com/ms/).
