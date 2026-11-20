const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/core.js");
const moment = require("moment-timezone");
const { weather, boston } = require("./fixtures.cjs");

test("US/metric conversions preserve zero and do not turn missing values into zero", () => {
  assert.equal(core.temperature(0, "us"), 32);
  assert.equal(core.temperature(-40, "us"), -40);
  assert.equal(core.temperature(10, "metric"), 10);
  assert.equal(core.wind(16.09344, "us"), 10);
  assert.equal(core.temperature(null, "us"), null);
  assert.equal(core.wind(undefined, "metric"), null);
  assert.equal(core.airLabel(151, "en"), "Unhealthy");
  assert.equal(core.airLabel(301, "en"), "Hazardous");
});

test("city search keeps ambiguous matches and rejects malformed locations", () => {
  const result = core.places({ results: [boston, { ...boston, name: "Boston", country: "United Kingdom", longitude: 0 }] });
  assert.equal(result.length, 2);
  assert.notEqual(core.placeKey(result[0]), core.placeKey(result[1]));
  assert.deepEqual(core.places({}), []);
  assert.throws(() => core.places({ results: [{ name: "Boston" }] }), /Invalid geocoding location/);
});

test("city-local dates and DST transitions use timezone data, not a fixed API offset", () => {
  assert.equal(core.dateKey(core.localParts(Date.parse("2026-11-20T02:00:00Z"), boston.timezone, moment)), "2026-11-19");
  const before = core.localParts(Date.parse("2026-03-08T06:59:00Z"), boston.timezone, moment);
  const after = core.localParts(Date.parse("2026-03-08T07:00:00Z"), boston.timezone, moment);
  assert.equal(before.hour, 1); assert.equal(after.hour, 3);
  assert.equal(before.offset, -300); assert.equal(after.offset, -240);
  assert.equal(core.localParts(Date.parse("2026-11-01T06:00:00Z"), boston.timezone, moment).hour, 1);
  assert.equal(core.localParts(Date.parse("2026-11-20T00:00:00Z"), "Asia/Kathmandu", moment).minute, 45);
});

test("weather refresh slots change at :10 and retain the previous day before midnight :10", () => {
  assert.equal(core.weatherSlot(Date.parse("2026-11-20T08:09:00Z"), boston.timezone, moment), "2026-11-20:0:-300");
  assert.equal(core.weatherSlot(Date.parse("2026-11-20T08:10:00Z"), boston.timezone, moment), "2026-11-20:1:-300");
  assert.equal(core.weatherSlot(Date.parse("2026-11-20T05:09:00Z"), boston.timezone, moment), "2026-11-19:7:-300");
});

test("normalization selects four hourly intervals and location-local daily forecasts", () => {
  const normalized = core.normalize(weather(), boston, Date.now());
  assert.equal(normalized.hourly.length, 4);
  assert.equal(normalized.hourly[3].time - normalized.hourly[0].time, 9 * 3600000);
  assert.equal(core.dailyFor(normalized, "2026-11-21", moment).high, 14);
  assert.equal(core.dailyFor(normalized, "2026-11-24", moment), null);
  const invalid = weather(); invalid.daily.temperature_2m_max[1] = null;
  assert.throws(() => core.normalize(invalid, boston, Date.now()), /Invalid daily weather/);
});

test("cache validation isolates places and rejects broken forecast data", () => {
  const cache = { version: 1, data: core.normalize(weather(), boston, Date.now()) };
  assert.equal(core.validCache(cache, boston), true);
  assert.equal(core.validCache(cache, { ...boston, longitude: 0 }), false);
  cache.data.daily[0].time = null;
  assert.equal(core.validCache(cache, boston), false);
});

test("URL settings and bookmarks round-trip unicode, zero coordinates, and widget flags", () => {
  const place = { ...boston, name: "广州 & Test", latitude: 0, longitude: 0 };
  const options = core.settings({ language: "zh", units: "metric", orientation: "landscape", lunar: true, almanac: true });
  const parsed = core.query(core.bookmark(place, options));
  assert.deepEqual(core.placeFromQuery(parsed.values), place);
  assert.deepEqual(core.settings(parsed.values), options);
  assert.equal(core.query("?city=%ZZ").errors.length, 1);
  assert.throws(() => core.placeFromQuery({ latitude: "", longitude: "0", timezone: "UTC" }), /required/);
  assert.throws(() => core.settings({ units: "kelvin" }), /Invalid setting/);
});

test("clothing advice uses Celsius thresholds independently of displayed Fahrenheit", () => {
  assert.equal(core.advice({ high: 14, rain: 40 }, "en"), "Long sleeves and a light jacket; take an umbrella.");
  assert.equal(core.advice(null, "en"), "Tomorrow's forecast unavailable");
  assert.equal(core.condition(71, "en"), "Snow");
  assert.equal(core.icon(71), "snow");
});
