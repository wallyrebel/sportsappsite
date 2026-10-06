# Watch webpage scoreboard

`mississippi-watch-scoreboard` runs on the watch hostname's root and `/watch/*` routes. It requests the existing `mississippi-sports-tv` static site through a service binding, then inserts the shared high-school ticker after `.watch-layout`. The existing video player, assets, catalog, and standalone video embed continue to come from the original Worker.

The iframe uses `https://mississippisportsapp.com/scoreboard/embed?group=statewide&days=8`. It includes today and the next seven days, rolls over in Central time, and shares the collector used by the county embeds. Only the watch HTML response adds the scoreboard origin to `frame-src`.

Run `npm run test:watch-scoreboard` and `npm run deploy:watch-scoreboard` after authenticating Wrangler with access to the site's Workers and routes. This deployment does not upload or replace the original player's assets. Cloudflare supports a route Worker in front of a Worker custom domain; the service binding explicitly targets the original player service.

Verify the root page and `/watch/sports/` display one scoreboard, and `/embed/sports/` and `/api/catalog.json` still work. To roll back the integration, remove these two routes from `mississippi-watch-scoreboard`; the original custom domain resumes serving the unmodified player. Future static deployments of the original site retain this integration as long as its Worker name and `.watch-layout` container remain the same.

Reference: https://developers.cloudflare.com/workers/configuration/routing/routes/
