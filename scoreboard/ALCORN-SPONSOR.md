# Alcorn County sponsor

The `alcorn` preset displays Score Wire, Alcorn County, and the supplied Steven Eaton / Modern Woodmen sponsor image in the fixed left column. Other county presets, custom teams, and the statewide wire do not display this sponsor. Selecting individual Alcorn schools in a custom group does not activate the sponsor.

Paste this into a WordPress Custom HTML block:

```html
<iframe src="https://mississippisportsapp.com/scoreboard/embed?group=alcorn&amp;days=8" title="Alcorn County scores and upcoming games" width="100%" height="264" style="display:block;border:0;border-radius:8px;"></iframe>
```

The feed includes Alcorn Central, Biggersville, Corinth, and Kossuth across the sports reported by the data sources. `days=8` includes today and the next seven days. Scores and schedules update automatically. The image opens at full size when clicked.

Use height 264 for the sponsor artwork; the builder selects this height automatically. Existing 144-pixel website embeds receive a compact version. For vMix, add `&mode=vmix` to the embed URL and use a 1920 × 1080 browser input; the sponsored strip is 264 pixels high at the bottom of the transparent canvas.

Sponsor configuration lives on the Alcorn preset in `public/shared.mjs`, with the supplied, unedited image at `public/sponsors/steven-eaton.jpg`. To replace the artwork, update that asset and rebuild/deploy the website.
