const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.cjs",
  use: { baseURL: "http://127.0.0.1:3100", browserName: "chromium" },
  webServer: { command: "PORT=3100 node scripts/preview.cjs", url: "http://127.0.0.1:3100/KindleReborn/", reuseExistingServer: false },
  reporter: "list"
});
