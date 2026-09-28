# Mississippi Sports broadcast

Display: **https://mississippisportsapp.com/broadcast**

Source-health dashboard: **https://mississippisportsapp.com/broadcast/status**

In vMix 28, add a **Web Browser** input, paste the display URL, and set the browser dimensions to **1920 × 1080**. The page supplies video graphics; vMix handles the custom RTMP output. The supplied Game Time Live music loop is enabled; enable the Web Browser input audio in vMix. The website and collector do not start vMix or an RTMP stream.

## What runs automatically

Cloudflare Worker `mississippi-sports-broadcast` runs every five minutes, independently of a browser or vMix. It selects sources whose refresh interval has elapsed, prioritizes news, then processes up to six other sources in oldest-attempt order. Data is stored in D1 `mississippi-sports-broadcast`. Pages uses its `BROADCAST` service binding to serve `/api/broadcast`.

The display polls the API every minute. It cycles the 20 latest SportsMississippi featured images/headlines, final scoreboards, upcoming events, published meet results, sidebar sponsors and main-panel sponsor slides. The headline crawl appears below the Mississippi Sports Group header; scores/upcoming events remain at the bottom. It retains the last successful browser snapshot on a network failure and labels it offline. Neither a page visit nor a site rebuild is needed to collect scores.

Target collection intervals (not a guarantee of upstream reporting speed):

| Sources | Interval | What is imported |
| --- | --- | --- |
| SportsMississippi WordPress | 10 minutes | 20 recent headlines, dates, featured images |
| MaxPreps Mississippi | 12 hours | Football, girls volleyball, boys/girls basketball, baseball, softball, boys/girls soccer; explicit finals and schedules |
| MAIS official scoreboards | 12 hours | Submitted varsity/A-team football, softball, baseball, boys/girls basketball and soccer finals |
| MAIS remaining result pages | 12 hours | Monitors for published results; unvalidated formats are withheld and flagged |
| MACCC | 12 hours | All-sport composite; previous three days through next seven days each pass |
| Official four-year calendars | 12 hours | All sports published by each school, including meet results |
| MileSplit MS | 12 hours | Public HS cross-country/indoor/outdoor meet listings and posted-result notices |

Intervals can be exceeded during source failures or scheduling backlog. Last-attempt and last-success timestamps show actual behavior. A successful empty response is labeled **EMPTY**, not proof of complete coverage. Errors retain the previous good data. Stale records carry their original observation timestamp. Games remain current between twice-daily collections; source failures mark retained games as last-known immediately, and records expire after two collection intervals.

**Cloud execution check, September 28, 2026:** the first scheduled provider checks successfully refreshed WordPress, MAIS football and Ole Miss. MaxPreps, the MACCC composite and MileSplit returned HTTP 403 to the Cloudflare collector despite successful local public-page verification. Their records are last-known data, not verified unattended feeds. The status dashboard surfaces these failures; permitted feed access or alternate official sources are required for reliable automatic updates. MACCC's alternate public scheduling app was inspected but contained copied draft schedules, so it was not silently substituted as confirmed data.

Seeded sources receive a first cloud collection without waiting for their normal interval. The dashboard's “Cloud refresh verified” timestamp distinguishes a successful scheduled fetch from initial local verification. A completed scheduler run may include individual source failures; both counts are shown.

## School coverage

Official all-sport calendar adapters are configured for Ole Miss, Mississippi State, Southern Miss, Jackson State, Alcorn State, Mississippi Valley State, Delta State, Mississippi Christian University, Millsaps, Blue Mountain Christian University (formerly Blue Mountain College), William Carey, Belhaven, and Mississippi University for Women.

Tougaloo uses its official PrestoSports composite. Rust is also registered, but the current official composite returned no current events during initial verification; it remains a visible coverage gap, not a claim of complete Rust coverage.

The live registry and coverage notes are in `src/broadcast/sources.ts`. The dashboard reports actual collection status. All 15 identified Mississippi NCAA/NAIA four-year schools are in scope. There is no paid data subscription in this implementation.

## Confirmed scores and limitations

- “Confirmed finals” means a trusted source explicitly labels a game final, or an official school reports W/L/T with both numeric scores. It does **not** mean two independent sources verified every game. Every displayed score identifies its source.
- Scheduled games never receive invented scores. A past scheduled date without a result becomes missing. Canceled/postponed games are not listed as upcoming.
- Meet placements and race-result links remain distinct from head-to-head finals. MileSplit result notices indicate a results link exists; they do not import paid athlete results or claim to verify a winner.
- The default game window is the previous seven days and next fourteen days. MaxPreps collects today's page plus two nearest reported dates on either side; a date missing from the public navigation remains a gap. MACCC/Tougaloo collect the previous three days through next seven days each pass; dates outside that narrower composite window remain a coverage gap.
- Conflicting numeric results for a confidently matched date/sport/team pairing are held off air and listed in the dashboard. Matching is conservative; differing school names not in the alias registry may remain separate. Same-source doubleheaders are preserved; ambiguous cross-source doubleheaders are withheld.
- MAIS includes schools outside Mississippi. The official table is association-wide. MaxPreps may also include association/out-of-state opponents. No unverified geographical exclusion is applied to MAIS members.
- All MAIS sports are in scope, but free public coverage is incomplete. Volleyball's official table currently contains individual set scores, not match finals. Several official meet-result pages are empty. Archery and cheer/dance still need verified schedule/result feeds. MaxPreps and MileSplit supplement MAIS where listed; they do not guarantee every MAIS event.
- MHSAA meet/individual sports beyond the connected race calendars need additional public result adapters. Team-submitted schedules may be incomplete. Public HTML formats can change; failures are surfaced rather than replaced with fabricated data.

Sources inspected: [MHSAA](https://www.misshsaa.com/), [MAIS official scoreboard](https://home.msais.org/scoreboard/bigscores.html), [MAIS sanctioned sports](https://home.msais.org/test2/code/athletics/handbook_entire.php), [MaxPreps/MHSAA reporting relationship](https://support.maxpreps.com/hc/en-us/articles/53622896380187-MaxPreps-and-the-Mississippi-High-School-Activities-Association-MHSAA), [MACCC](https://www.macccathletics.com/composite), [MileSplit MS](https://ms.milesplit.com/calendar), and each school's official calendar linked in the registry.

## Sponsors

The user-supplied Casey Lott injury-law ad alternates with “Your ad here — 662-587-6575” every 20 seconds in the bottom-right sidebar. The two ads also alternate in the main story panel for 15 seconds every five minutes, leaving the header and tickers visible. Its complete square artwork is displayed without cropping. No end date was supplied; the placement remains active until changed.

Edit `public/broadcast-sponsors.json` and publish through the site's normal Git deployment. The browser rechecks this file every minute. Existing homepage advertisers are not silently enrolled in broadcast placements. Empty inventory displays a house ad.

```json
{
  "sidebarSeconds": 20,
  "fullscreenEverySeconds": 300,
  "fullscreenSeconds": 15,
  "sponsors": [{
    "name": "Sponsor name",
    "image": "/sponsors/approved-sidebar-art.png",
    "fullscreenImage": "/sponsors/approved-fullscreen-art.png",
    "placements": ["sidebar", "fullscreen"],
    "active": true,
    "startsAt": "2026-10-01T00:00:00-05:00",
    "endsAt": "2026-11-01T00:00:00-05:00"
  }]
}
```

Artwork uses contain fitting to preserve all text. The sidebar image area is roughly 375 × 260 pixels; square artwork is supported. ISO start/end timestamps must include an offset or `Z`.

## Optional background music

The user-supplied **Game Time Live** track is enabled in `public/broadcast-audio.json` at volume `0.15`, sourced from `/audio/game-time-live.mp3`. It repeats using the browser's audio loop setting. To replace it, update `src` and provide the replacement in `public/audio/`. A stable HTTPS audio URL, including your WordPress media library, can also be used. The browser rechecks configuration each minute without restarting an unchanged track. MP3 or WAV is appropriate; use a track edited for a clean loop if you need a seamless join.

In vMix, enable audio on the Web Browser input and set its mixer level. Browser autoplay rules may require one interaction: open `/broadcast?controls=1` for visible audio controls and press Play in vMix's browser interaction view if necessary. Use `/broadcast?audio=off` for a silent input. Controls are hidden on the normal broadcast URL. The music track is independent of story/score rotations and continues during sponsor slides.

## Alerts and operations

The read-only status dashboard is public and contains no credentials or private contact details. There are no unauthenticated write/admin endpoints.

Email needs the user's recipient in `ALERT_EMAIL` and a Worker `RESEND_API_KEY` secret. The sender must be verified with the mail provider. It sends a digest for three consecutive failures or score conflicts, at most once per six hours. Until configured, the dashboard is the active alert mechanism. The website's existing contact-form key is not copied or exposed.

Deployment/recovery:

1. `npm ci` and `npm run types:broadcast`.
2. `npm run test:broadcast` and `npm run check:broadcast`.
3. Apply all SQL files in `workers/broadcast/migrations/` to D1 in numeric order when provisioning a new database.
4. `npm run deploy:broadcast`. Verify the scheduler `*/5 * * * *` and D1 binding.
5. Ensure Pages project `sportsappsite` has `BROADCAST` service binding to `mississippi-sports-broadcast` in preview and production.
6. Publish the website through Git/Cloudflare Pages. Check `/api/broadcast` and `/broadcast/status`.

Source failure does not trigger aggressive immediate retries. Fetches have deadlines and body-size limits. Old snapshots are retained only within the published date window. Tests cover false finals, zero scores, national-card exclusion, varsity filtering, conflicts, doubleheaders, structured college results, race listings and oversized responses. `npm run verify:broadcast` performs optional live source checks and saves local-only research snapshots; it is never part of a website build.

Cloudflare cron configuration can take several minutes to propagate. A configured schedule alone is not proof of an executed refresh: inspect increasing `lastAttempt`/`lastSuccess` in D1 or the dashboard. HTML parsing may exceed the Workers Free CPU limit; check actual Worker outcomes and the existing account plan. No paid plan upgrade is performed by the deployment.

To roll back the display, roll back the Pages deployment. To pause collection, remove the collector's cron trigger in Cloudflare; existing last-good data remains in D1 and will become visibly stale. Do not delete D1 to pause updates.
