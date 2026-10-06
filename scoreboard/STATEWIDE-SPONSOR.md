# Mississippi statewide sponsor

The `statewide` preset displays Score Wire, Mississippi, and the supplied Casey Lott Injury Law artwork in the fixed left column. County and custom-team presets do not inherit this sponsor. Alcorn County retains its separate Steven Eaton sponsor.

Paste this into a WordPress Custom HTML block:

```html
<iframe src="https://mississippisportsapp.com/scoreboard/embed?group=statewide&amp;days=8&amp;v=20261006-statewide" title="Mississippi scores and upcoming games" width="100%" height="264" style="display:block;border:0;border-radius:8px;"></iframe>
```

The feed includes available statewide high-school games across the sports reported by the data sources. `days=8` includes today and the next seven days; dates and reported scores refresh automatically. The sponsor image opens at its original size when clicked.

The builder selects the 264-pixel height automatically. Older 144-pixel website embeds show a compact sponsor. The watch-page integration uses the taller layout. For vMix, add `&mode=vmix` and use a 1920 × 1080 browser input; the sponsored strip is 264 pixels high at the bottom of a transparent canvas.

Sponsor configuration lives on the statewide preset in `public/shared.mjs`. The original, unedited PNG is `public/sponsors/casey-lott.png`. After changing sponsor configuration, update the asset release query in the scoreboard HTML and module references together so previously cached scripts do not retain the older sponsor. Rebuild and deploy the website; the watch-page Worker requires its separate deployment for embed URL or height changes.
