const { test, expect } = require("@playwright/test");
const { weather, boston } = require("./fixtures.cjs");
const location = "?latitude=42.36&longitude=-71.06&timezone=America%2FNew_York&name=Boston&country=United%20States";

async function prepare(page) {
  await page.clock.install({ time: new Date("2026-11-20T17:00:00Z") });
  await page.route("https://api.open-meteo.com/**", route => route.fulfill({ json: weather() }));
  await page.route("https://air-quality-api.open-meteo.com/**", route => route.fulfill({ json: { current: { us_aqi: 35 } } }));
}

for (const orientation of ["portrait", "landscape"]) {
  for (const configuration of [
    { language: "en", enabled: false }, { language: "en", enabled: true }, { language: "zh", enabled: true }
  ]) {
    const { enabled, language } = configuration;
    test(`${orientation}/${language}: optional widgets ${enabled ? "shown" : "hidden"} reflow without viewport overflow`, async ({ page }) => {
      await page.setViewportSize(orientation === "portrait" ? { width: 560, height: 780 } : { width: 780, height: 560 });
      await prepare(page);
      await page.goto("/KindleReborn/" + location + `&orientation=${orientation}&language=${language}&lunar=${enabled ? 1 : 0}&almanac=${enabled ? 1 : 0}`);
      await expect(page.locator("#temp")).toHaveText("50°F");
      await page.clock.runFor(1300);
      await expect(page.locator("#weather-widget #weather-city")).toHaveText("Boston");
      const cityBox = await page.locator("#weather-city").boundingBox();
      const temperatureBox = await page.locator("#temp").boundingBox();
      expect(Math.abs(cityBox.x + cityBox.width / 2 - temperatureBox.x - temperatureBox.width / 2)).toBeLessThanOrEqual(1);
      expect(cityBox.y + cityBox.height).toBeLessThan(temperatureBox.y);
      expect(temperatureBox.y - cityBox.y - cityBox.height).toBeLessThanOrEqual(12);
      await expect(page.locator("#board > .weather-credit")).toBeVisible();
      await expect(page.locator("#weather-widget .weather-credit")).toHaveCount(0);
      await expect(page.locator("#refresh-weather")).toBeHidden();
      await expect(page.locator("#open-settings, .weather-tools")).toHaveCount(0);
      await expect(page.locator("#weather-notice")).toBeHidden();
      await expect(page.locator(".toolbar, .page-footer, #clock-note, #timezone, .tomorrow-panel, #dressing")).toHaveCount(0);
      const typeSizes = await page.evaluate(() => ["time", "temp", "calendar", "hourly"].map(id => {
        const node = document.getElementById(id);
        return parseFloat(getComputedStyle(id === "hourly" ? node.querySelector("b") : node).fontSize);
      }));
      expect(typeSizes[0]).toBeGreaterThanOrEqual(60);
      expect(typeSizes[1]).toBeGreaterThanOrEqual(48);
      expect(typeSizes[2]).toBeGreaterThanOrEqual(21);
      expect(typeSizes[3]).toBeGreaterThanOrEqual(23);
      await expect(page.locator("#lunar-panel")).toBeVisible({ visible: enabled });
      await expect(page.locator("#almanac-panel")).toBeVisible({ visible: enabled });
      const dimensions = await page.evaluate(() => {
        const ids = ["board", "core-panels", "lunar-panel", "almanac-panel"];
        return Object.fromEntries(ids.map(id => {
          const node = document.getElementById(id), box = node.getBoundingClientRect();
          return [id, { height: box.height, bottom: box.bottom, right: box.right, scroll: node.scrollHeight, client: node.clientHeight }];
        }));
      });
      const height = orientation === "portrait" ? 780 : 560;
      expect(dimensions.board.bottom).toBeLessThanOrEqual(height);
      const creditBox = await page.locator(".weather-credit").boundingBox();
      expect(Math.max(dimensions["core-panels"].bottom, dimensions["lunar-panel"].bottom, dimensions["almanac-panel"].bottom)).toBeLessThanOrEqual(creditBox.y);
      expect(creditBox.y).toBeGreaterThanOrEqual(dimensions.board.bottom - 16);
      expect(creditBox.y + creditBox.height).toBeLessThanOrEqual(height);
      expect(dimensions.board.scroll).toBeLessThanOrEqual(dimensions.board.client + 1);
      expect(dimensions["core-panels"].height).toBeCloseTo(dimensions.board.height - (enabled ? 124 : 0) - 16, 0);
      if (!enabled) expect(dimensions["almanac-panel"].height).toBe(0);
      const overflow = await page.evaluate(() => {
        const elements = document.querySelectorAll("#board *");
        return Array.from(elements).filter(node => node.clientHeight && node.scrollHeight > node.clientHeight + 2).map(node => node.id || node.className);
      });
      expect(overflow).toEqual([]);
    });
  }
}

test("settings change language/units and hiding panels expands the core without refetching", async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 780 });
  await prepare(page);
  await page.goto("/KindleReborn/" + location + "&lunar=1&almanac=1");
  await expect(page.locator("#temp")).toHaveText("50°F"); await page.clock.runFor(1300);
  const before = await page.locator("#core-panels").boundingBox();
  let requests = 0;
  page.on("request", request => { if (new URL(request.url()).hostname === "api.open-meteo.com") requests++; });
  await page.locator("#weather-city").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#settings-panel")).toBeVisible();
  await expect(page.locator("#weather-city")).toHaveAttribute("aria-expanded", "true");
  await page.selectOption("#language", "zh"); await page.selectOption("#units", "metric");
  await page.locator("#show-almanac").uncheck();
  await page.locator("#display-settings button").click();
  await expect(page.locator("#temp")).toHaveText("10°C");
  await expect(page.locator("#wind")).toHaveText("西 16 km/h");
  await expect(page.locator("#condition")).toHaveText("多云");
  await expect(page.locator("#bookmark")).toHaveAttribute("href", /language=zh.*units=metric/);
  const after = await page.locator("#core-panels").boundingBox();
  expect(after.height - before.height).toBeCloseTo(88, 0);
  await expect(page.locator("#almanac-panel")).toBeHidden();
  await expect(page.locator("#lunar-panel")).toBeVisible();
  expect(requests).toBe(0);
});

test("weather works when storage, modern networking, and air-quality requests are unavailable", async ({ page }) => {
  await prepare(page);
  await page.addInitScript(() => {
    window.fetch = undefined; window.Intl = undefined;
    Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage disabled"); } });
  });
  await page.route("https://air-quality-api.open-meteo.com/**", route => route.abort());
  await page.goto("/KindleReborn/" + location);
  await expect(page.locator("#temp")).toHaveText("50°F");
  await expect(page.locator("#air")).toHaveText("--");
  await expect(page.locator("#weather-notice")).toContainText("Storage unavailable");
  await expect(page.locator("#weather-notice")).toContainText("Air quality unavailable");
  await expect(page.locator("#time")).toHaveText("12:00");
});

test("failed startup requests retain clearly stale cached weather", async ({ page }) => {
  await prepare(page);
  await page.goto("/KindleReborn/" + location);
  await expect(page.locator("#temp")).toHaveText("50°F");
  await page.route("https://api.open-meteo.com/**", route => route.abort());
  await page.reload();
  await expect(page.locator("#temp")).toHaveText("50°F");
  await expect(page.locator("#weather-notice")).toContainText("Weather unavailable");
  await expect(page.locator("#weather-notice")).toContainText("Stale cached weather");
  await page.route("https://api.open-meteo.com/**", route => route.fulfill({ json: weather() }));
  await page.clock.runFor(1300);
  await page.locator("#weather-city").click();
  await expect(page.locator("#settings-panel #refresh-weather")).toBeVisible();
  await page.locator("#refresh-weather").click();
  await expect(page.locator("#weather-notice")).toBeHidden();
  await page.locator("#close-settings").click();
  await expect(page.locator("#settings-panel")).toBeHidden();
  await expect(page.locator("#weather-city")).toBeFocused();
  await expect(page.locator("#weather-city")).toHaveAttribute("aria-expanded", "false");
});

test("ambiguous city results require selection and render API text safely", async ({ page }) => {
  await prepare(page);
  await page.route("https://geocoding-api.open-meteo.com/**", route => route.fulfill({
    json: { results: [boston, { ...boston, name: "<img onerror=alert(1)>", country: "United Kingdom" }] }
  }));
  await page.goto("/KindleReborn/?city=Boston");
  await expect(page.locator("#city-results button")).toHaveCount(2);
  await expect(page.locator("#temp")).toHaveText("--");
  await expect(page.locator("#city-results img")).toHaveCount(0);
  await page.clock.runFor(1300); await page.locator("#city-results button").first().click();
  await expect(page.locator("#temp")).toHaveText("50°F");
});

test("overdue weather and the calendar refresh after local midnight and resume", async ({ page }) => {
  await prepare(page);
  await page.goto("/KindleReborn/" + location);
  await expect(page.locator("#temp")).toHaveText("50°F");
  let requests = 0;
  page.on("request", request => { if (new URL(request.url()).hostname === "api.open-meteo.com") requests++; });
  await page.clock.setSystemTime(new Date("2026-11-21T05:11:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("#date")).toHaveText("2026 / 11 / 21");
  await expect.poll(() => requests).toBe(1);
});

test("late weather responses from a previous city cannot overwrite the selected location", async ({ page }) => {
  await prepare(page);
  let oldRequest;
  await page.route("https://api.open-meteo.com/**", async route => {
    if (new URL(route.request().url()).searchParams.get("longitude") === "-71.06") oldRequest = route;
    else {
      const response = weather(); response.current.temperature_2m = 20;
      await route.fulfill({ json: response });
    }
  });
  await page.route("https://geocoding-api.open-meteo.com/**", route => route.fulfill({
    json: { results: [{ ...boston, name: "London", country: "United Kingdom", latitude: 51.5, longitude: 0, timezone: "Europe/London" }] }
  }));
  await page.goto("/KindleReborn/" + location);
  await expect.poll(() => !!oldRequest).toBe(true);
  await page.clock.runFor(1300);
  await page.locator("#weather-city").click(); await page.locator("#city-input").fill("London");
  await page.locator("#city-search button").click(); await page.locator("#city-results button").click();
  await expect(page.locator("#temp")).toHaveText("68°F");
  await oldRequest.fulfill({ json: weather() });
  await page.clock.runFor(60000);
  await expect(page.locator("#temp")).toHaveText("68°F");
  await expect(page.locator("#weather-city")).toHaveText("London");
});

test("weather automatically refreshes at the next three-hour :10 slot", async ({ page }) => {
  await prepare(page);
  await page.clock.setSystemTime(new Date("2026-11-20T17:09:00Z"));
  await page.goto("/KindleReborn/" + location);
  await expect(page.locator("#temp")).toHaveText("50°F");
  let requests = 0;
  page.on("request", request => { if (new URL(request.url()).hostname === "api.open-meteo.com") requests++; });
  await page.clock.runFor(60000);
  await expect(page.locator("#time")).toHaveText("12:10");
  await expect.poll(() => requests).toBe(1);
});
