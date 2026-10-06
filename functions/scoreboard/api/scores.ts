// Shared with the standalone embed Worker; no HTML scraping in Pages requests.
// @ts-ignore JavaScript module is tested with node:test.
import {scoresResponse} from '../../../scoreboard/lib/snapshot.mjs';
export const onRequest:PagesFunction=({request})=>scoresResponse(request);
