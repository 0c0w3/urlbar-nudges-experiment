/* Any copyright is dedicated to the Public Domain.
* http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// The path of the add-on file relative to `getTestFilePath`.
const ADDON_PATH = "urlbar_tips-1.0.0.zip";

// Use SIGNEDSTATE_MISSING when testing an unsigned, in-development version of
// the add-on and SIGNEDSTATE_PRIVILEGED when testing the production add-on.
const EXPECTED_ADDON_SIGNED_STATE = AddonManager.SIGNEDSTATE_MISSING;
// const EXPECTED_ADDON_SIGNED_STATE = AddonManager.SIGNEDSTATE_PRIVILEGED;

add_task(async function init() {
  let previousDefaultEngine = await Services.search.getDefault();
  await initAddonTest(ADDON_PATH, EXPECTED_ADDON_SIGNED_STATE);

  registerCleanupFunction(async function() {
    Services.search.setDefault(previousDefaultEngine);
  });
});

add_task(async function google() {
  Services.search.setDefault(Services.search.getEngineByName("Google"));

  await withAddon(async () => {
    let testPromise = awaitAddonMessage("Page is engine homepage: true");
    await BrowserTestUtils.loadURI(
      gBrowser.selectedBrowser,
      "example.com/google"
    );
    await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
    await testPromise;
    Assert.ok(true, "Page is engine homepage.");

    testPromise = awaitAddonMessage("Page is engine homepage: false");
    await BrowserTestUtils.loadURI(
      gBrowser.selectedBrowser,
      "example.com/bing"
    );
    await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
    await testPromise;
    Assert.ok(true, "Page is not engine homepage.");

    testPromise = awaitAddonMessage("Page is engine homepage: true");
    await BrowserTestUtils.loadURI(
      gBrowser.selectedBrowser,
      "http://example.com/google?tracker=true"
    );
    await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
    await testPromise;
    Assert.ok(true, "Page is engine homepage.");

    testPromise = awaitAddonMessage("Page is engine homepage: false");
    await BrowserTestUtils.loadURI(
      gBrowser.selectedBrowser,
      "example.com/google/maps"
    );
    await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
    await testPromise;
    Assert.ok(true, "Page is not engine homepage.");
  });
});

add_task(async function bing() {
  Services.search.setDefault(Services.search.getEngineByName("Bing"));

  await withAddon(async () => {
    let testPromise = awaitAddonMessage("Page is engine homepage: true");
    await BrowserTestUtils.loadURI(
      gBrowser.selectedBrowser,
      "example.com/bing"
    );
    await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
    await testPromise;
    Assert.ok(true, "Page is engine homepage.");

    testPromise = awaitAddonMessage("Page is engine homepage: true");
    await BrowserTestUtils.loadURI(
      gBrowser.selectedBrowser,
      "http://example.com/bing?tracker=true"
    );
    await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
    await testPromise;
    Assert.ok(true, "Page is engine homepage.");

    testPromise = awaitAddonMessage("Page is engine homepage: false");
    await BrowserTestUtils.loadURI(gBrowser.selectedBrowser, "example.com/ddg");
    await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
    await testPromise;
    Assert.ok(true, "Page is not engine homepage.");
  });
});

add_task(async function duckduckgo() {
  Services.search.setDefault(Services.search.getEngineByName("DuckDuckGo"));

  await withAddon(async () => {
    let testPromise = awaitAddonMessage("Page is engine homepage: true");
    await BrowserTestUtils.loadURI(
      gBrowser.selectedBrowser,
      "http://example.com/ddg"
    );
    await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
    await testPromise;
    Assert.ok(true, "Page is engine homepage.");

    testPromise = awaitAddonMessage("Page is engine homepage: true");
    await BrowserTestUtils.loadURI(
      gBrowser.selectedBrowser,
      "http://example.com/ddg?tracker=true"
    );
    await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
    await testPromise;
    Assert.ok(true, "Page is engine homepage.");
  });
});
