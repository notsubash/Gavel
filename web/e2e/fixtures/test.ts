/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixture callback named `use` */
import { test as base, expect } from "@playwright/test";

/** Clears persisted UI settings after each test so serial specs do not leak state. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page);
    try {
      await page.evaluate(() => {
        localStorage.removeItem("rms-advanced-settings");
        localStorage.removeItem("rms-run-fold-variant");
      });
    } catch {
      // ponytail: about:blank or cross-origin after crash — nothing to clear
    }
  },
});

export { expect };
