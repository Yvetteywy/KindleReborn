# Static Kindle dashboard instructions

Status: approved. Follow the implementation sequence in
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Architecture

- Deploy a static site to GitHub Pages. No runtime application server, API proxy,
  server-side secrets, or server-side filesystem cache.
- Build-time tooling and a local static preview server are allowed.
- Use relative asset paths so deployment works at a repository subpath.
- Fetch live data only from HTTPS APIs that permit browser cross-origin requests.
- Never embed API keys in the site. Remove or explicitly redesign features that
  require private server credentials; do not present fabricated data as live.

## Kindle compatibility

- Target the browser supplied with Kindle firmware 5.16.2.
- Ship ES5-compatible JavaScript and use XMLHttpRequest. Do not require fetch,
  promises, async functions, modules, Intl, or service workers.
- Prefer basic HTML, table/float layouts, and conservative CSS. Do not require
  flexbox, grid, CSS custom properties, or viewport units for the core layout.
- Guard browser storage access. The clock and calendar must work even when
  storage or remote requests fail.
- Show loading, missing-data, stale-cache, and network-error states explicitly.
- Keep the monochrome, animation-free e-ink experience and existing scheduled
  black/white redraw behavior unless an approved change requires otherwise.
- Update the clock every minute and the calendar at location-local midnight.
  Fetch weather on startup, location changes, and every three hours at :10;
  refresh overdue data when the page resumes. Time depends on the device clock.
- Syntax and desktop browser checks are not proof of firmware compatibility.
  Record real-device HTTPS, API, rendering, and interaction checks separately.

## Internationalization

- Support locations outside China, with explicit selection when city names
  match multiple places.
- Use the selected location's date and time rather than a fixed UTC+8 offset.
  Account for daylight-saving changes without requiring browser Intl support.
- Keep language, units, location, and orientation as independent settings.
- Support English and Chinese, and US customary and metric units. Default to
  English and US customary units.
- US customary units include Fahrenheit and mph.
- Do not assume Chinese labels or metric units when rendering weather.
- Include selectable portrait and landscape layouts. A landscape layout does
  not guarantee that the device browser itself supports physical rotation.

## Optional panels

- Keep lunar calendar and almanac as independently optional panels, hidden by
  default. Defer horoscope until a static-compatible data source is approved.
- Removing a panel must reclaim its layout space, not leave a blank rectangle.
- Reflow visible panels in both orientations and let the core calendar/weather
  panels use reclaimed space. Preserve readable type and prevent viewport
  overflow; do not merely hide panel content inside a fixed-size slot.
- Prefer simple panel ordering controls over drag-and-drop for Kindle.
- Lunar calendar and almanac may use bundled client-side calculations.
- The existing live horoscope requires a secret key. Do not move that key into
  browser code. Decide its static-compatible data delivery before implementing
  the panel; never substitute invented predictions.

## Validation and documentation

- Test data normalization, units, location ambiguity, time zones and DST,
  cache isolation, and failure states with focused automated tests.
- Check project-subpath deployment and portrait layout at 560 x 780.
- Also check the landscape layout at 780 x 560.
- Document static deployment, configuration, data attribution, API limits,
  removed features, and known device limitations.
- Preserve unrelated worktree changes.
