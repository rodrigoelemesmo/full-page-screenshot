const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,      // captures are slow (scroll + ~0.6s per slice)
  expect: { timeout: 10_000 },
  fullyParallel: false,  // one Chromium window, shared extension
  workers: 1,
  retries: 0,
  reporter: "list",
});
