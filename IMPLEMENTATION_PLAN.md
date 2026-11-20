# Approved static-site implementation plan

## Goal

Replace the runtime Express server with a GitHub Pages dashboard targeting
Kindle firmware 5.16.2. Support international locations, English/Chinese,
US/metric units, portrait/landscape, and optional lunar calendar/almanac panels.
Horoscope is deferred. Follow [instruction.md](instruction.md).

## Implementation sequence

1. Replace the server's geocoding, weather, and air-quality aggregation with
   browser XMLHttpRequest calls and testable normalization. Keep air-quality
   failures independent of weather, show request errors, and mark stale data.
2. Add location search with explicit country/region selection, URL settings,
   guarded local storage, and caches isolated by location. Ignore obsolete
   responses after changing location.
3. Add English/Chinese and US/metric presentation. Use the selected location's
   timezone, including DST, without requiring browser Intl. Keep advice
   thresholds independent of display units.
4. Rebuild the existing monochrome layout with conservative HTML/CSS, relative
   assets, portrait/landscape settings, and honest loading placeholders.
   Disabled panels reclaim space; calendar/weather use the remaining area.
   Start with show/hide controls, not drag-and-drop.
5. Bundle ES5-compatible lunar calculations locally. Keep lunar calendar and
   almanac optional and hidden by default; provide understandable English
   presentation. Remove the existing horoscope interface and secret-key API.
6. Remove server files/dependencies/configuration after the replacement works.
   Provide static build/preview commands and a GitHub Actions Pages deployment
   publishing only public assets.
7. Validate normalization, units, ambiguous cities, timezones/DST, cache
   isolation, network/storage failures, and project-subpath deployment.
   Check portrait at 560 x 780 and landscape at 780 x 560 with optional panels
   on/off. Update setup, attribution, and compatibility documentation.

## Automatic updates

- Update time every minute using the device clock adjusted to the city's zone.
- Update the calendar at city-local midnight, independently of weather.
- Load weather on startup and location changes, then every three hours at :10.
- Check for overdue updates when the page resumes after sleep.
- Keep cached weather visible with an explicit stale indicator if requests fail.
- Preserve the scheduled city-local 07:00/17:00 black/white e-ink redraw.

## Compatibility gate

Probe direct HTTPS API access early. Automated syntax and browser checks do not
prove Kindle compatibility. After deployment, the user must verify HTTPS,
cross-origin API requests, layout, controls, and resume behavior on a Kindle
running 5.16.2. GitHub Pages cannot repair unsupported device TLS/CORS behavior
or guarantee physical browser rotation.
