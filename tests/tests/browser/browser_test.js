/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

// End-to-end test.  This doesn't test the max-shown-count limit because it
// requires restarting the browser.

"use strict";

XPCOMUtils.defineLazyModuleGetters(this, {
  AppMenuNotifications: "resource://gre/modules/AppMenuNotifications.jsm",
  HttpServer: "resource://testing-common/httpd.js",
  ProfileAge: "resource://gre/modules/ProfileAge.jsm",
  UrlbarPrefs: "resource:///modules/UrlbarPrefs.jsm",
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.jsm",
});

// The path of the add-on file relative to `getTestFilePath`.
const ADDON_PATH = "urlbar_tips-1.0.0.zip";

// Use SIGNEDSTATE_MISSING when testing an unsigned, in-development version of
// the add-on and SIGNEDSTATE_PRIVILEGED when testing the production add-on.
const EXPECTED_ADDON_SIGNED_STATE = AddonManager.SIGNEDSTATE_MISSING;
// const EXPECTED_ADDON_SIGNED_STATE = AddonManager.SIGNEDSTATE_PRIVILEGED;

const BRANCHES = {
  CONTROL: "control",
  TREATMENT: "treatment",
};

// Should match the same const in background.js.
const SHOW_TIP_DELAY_MS = 200;

// Should match the same const in background.js.
const LAST_UPDATE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const TIPS = {
  NONE: 0,
  ONBOARD: 1,
  REDIRECT: 2,
};

add_task(async function init() {
  await PlacesUtils.history.clear();
  await PlacesUtils.bookmarks.eraseEverything();

  // Write an old profile age so tips are actually shown.
  let age = await ProfileAge();
  let originalTimes = age._times;
  let date = Date.now() - LAST_UPDATE_THRESHOLD_MS - 30000;
  age._times = { created: date, firstUse: date };
  await age.writeTimes();

  registerCleanupFunction(async () => {
    let age = await ProfileAge();
    age._times = originalTimes;
    await age.writeTimes();
  });

  await initAddonTest(ADDON_PATH, EXPECTED_ADDON_SIGNED_STATE);
});

// The onboarding tip should be shown on about:newtab.
add_task(async function newtab() {
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await checkTab(window, "about:newtab", TIPS.ONBOARD);
    });
  });
});

// The onboarding tip should be shown on about:home.
add_task(async function home() {
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await checkTab(window, "about:home", TIPS.ONBOARD);
    });
  });
});

// The redirect tip should be shown for www.google.com when it's the default
// engine.
add_task(async function google() {
  await setDefaultEngine("Google");
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await withDNSRedirect("www.google.com", "/", async url => {
        await checkTab(window, url, TIPS.REDIRECT);
      });
    });
  });
});

// The redirect tip should be shown for www.google.com/webhp when it's the
// default engine.
add_task(async function googleWebhp() {
  await setDefaultEngine("Google");
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await withDNSRedirect("www.google.com", "/webhp", async url => {
        await checkTab(window, url, TIPS.REDIRECT);
      });
    });
  });
});

// The redirect tip should not be shown for www.google.com when it's not the
// default engine.
add_task(async function googleNotDefault() {
  await setDefaultEngine("Bing");
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await withDNSRedirect("www.google.com", "/", async url => {
        await checkTab(window, url, TIPS.NONE);
      });
    });
  });
});

// The redirect tip should not be shown for www.google.com/webhp when it's not
// the default engine.
add_task(async function googleWebhpNotDefault() {
  await setDefaultEngine("Bing");
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await withDNSRedirect("www.google.com", "/webhp", async url => {
        await checkTab(window, url, TIPS.NONE);
      });
    });
  });
});

// The redirect tip should be shown for www.bing.com when it's the default
// engine.
add_task(async function bing() {
  await setDefaultEngine("Bing");
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await withDNSRedirect("www.bing.com", "/", async url => {
        await checkTab(window, url, TIPS.REDIRECT);
      });
    });
  });
});

// The redirect tip should not be shown for www.bing.com when it's not the
// default engine.
add_task(async function bingNotDefault() {
  await setDefaultEngine("Google");
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await withDNSRedirect("www.bing.com", "/", async url => {
        await checkTab(window, url, TIPS.NONE);
      });
    });
  });
});

// The redirect tip should be shown for duckduckgo.com when it's the default
// engine.
add_task(async function ddg() {
  await setDefaultEngine("DuckDuckGo");
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await withDNSRedirect("duckduckgo.com", "/", async url => {
        await checkTab(window, url, TIPS.REDIRECT);
      });
    });
  });
});

// The redirect tip should be shown for start.duckduckgo.com when it's the
// default engine.
add_task(async function ddgStart() {
  await setDefaultEngine("DuckDuckGo");
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await withDNSRedirect("start.duckduckgo.com", "/", async url => {
        await checkTab(window, url, TIPS.REDIRECT);
      });
    });
  });
});

// The redirect tip should not be shown for duckduckgo.com when it's not the
// default engine.
add_task(async function ddgNotDefault() {
  await setDefaultEngine("Google");
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await withDNSRedirect("duckduckgo.com", "/", async url => {
        await checkTab(window, url, TIPS.NONE);
      });
    });
  });
});

// The redirect tip should not be shown for start.duckduckgo.com when it's not
// the default engine.
add_task(async function ddgStartNotDefault() {
  await setDefaultEngine("Google");
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await withDNSRedirect("start.duckduckgo.com", "/", async url => {
        await checkTab(window, url, TIPS.NONE);
      });
    });
  });
});

// The redirect tip should not be shown on a non-engine page.
add_task(async function nonEnginePage() {
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await checkTab(window, "http://example.com/", TIPS.NONE);
    });
  });
});

// Tips should be shown at most once per session.
add_task(async function oncePerSession() {
  await setDefaultEngine("Google");
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await checkTab(window, "about:newtab", TIPS.ONBOARD);
      await checkTab(window, "about:newtab", TIPS.NONE);
      await withDNSRedirect("www.google.com", "/", async url => {
        await checkTab(window, url, TIPS.NONE);
      });
    });
  });
});

// The tip shouldn't be shown when there's another notification present.
add_task(async function notification() {
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await BrowserTestUtils.withNewTab("about:blank", async () => {
        let box = gBrowser.getNotificationBox();
        let note = box.appendNotification(
          "Test",
          "urlbar-test",
          null,
          box.PRIORITY_INFO_HIGH,
          null,
          null,
          null
        );
        // Give it a big persistence so it doesn't go away on page load.
        note.persistence = 100;
        await withDNSRedirect("www.google.com", "/", async url => {
          await BrowserTestUtils.loadURI(gBrowser.selectedBrowser, url);
          await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
          await checkTip(window, TIPS.NONE);
          box.removeNotification(note, true);
        });
      });
    });
  });
});

// The tip should be shown when switching to a tab where it should be shown.
add_task(async function tabSwitch() {
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      let tab = BrowserTestUtils.addTab(gBrowser, "about:newtab");
      await BrowserTestUtils.switchTab(gBrowser, tab);
      await checkTip(window, TIPS.ONBOARD);
      BrowserTestUtils.removeTab(tab);
    });
  });
});

// Checks engagement event telemetry and experiment telemetry after triggering
// the onboard tip on the treatment branch.  We have a separate comprehensive
// test in the tree for engagement event telemetry, so we don't test everything
// here.  We only make sure that it's recorded.
add_task(async function telemetryTreatmentOnboard() {
  Services.telemetry.clearScalars();
  Services.telemetry.clearEvents();
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      let tab = await BrowserTestUtils.openNewForegroundTab({
        gBrowser,
        url: "about:newtab",
        waitForLoad: false,
      });

      await checkTip(window, TIPS.ONBOARD, false);

      // Pick the tip button by pressing enter.  The tip is the heuristic and
      // the button is preselected, which is why this should work.
      await UrlbarTestUtils.promisePopupClose(window, () => {
        EventUtils.synthesizeKey("KEY_Enter");
      });

      BrowserTestUtils.removeTab(tab);

      TelemetryTestUtils.assertKeyedScalar(
        TelemetryTestUtils.getProcessScalars("dynamic", true),
        "urlbarTipsExperiment.tipShownCount",
        "onboard",
        1
      );

      TelemetryTestUtils.assertEvents([
        {
          category: "urlbar",
          method: "engagement",
          object: "enter",
          value: "typed",
          extra: {
            elapsed: val => parseInt(val) > 0,
            numChars: "0",
            selIndex: "0",
            selType: "tip",
          },
        },
      ]);
    });
  });
});

// Checks engagement event telemetry and experiment telemetry after triggering
// the redirect tip on the treatment branch.
add_task(async function telemetryTreatmentRedirect() {
  await setDefaultEngine("Google");
  Services.telemetry.clearScalars();
  Services.telemetry.clearEvents();
  await withStudy({ branch: BRANCHES.TREATMENT }, async () => {
    await withAddon(async () => {
      await withDNSRedirect("www.google.com", "/", async url => {
        let tab = await BrowserTestUtils.openNewForegroundTab({
          gBrowser,
          url,
        });

        await checkTip(window, TIPS.REDIRECT, false);

        // Click the tip button.
        await UrlbarTestUtils.promisePopupClose(window, () => {
          EventUtils.synthesizeMouseAtCenter(gURLBar.view.selectedElement, {});
        });

        BrowserTestUtils.removeTab(tab);

        TelemetryTestUtils.assertKeyedScalar(
          TelemetryTestUtils.getProcessScalars("dynamic", true),
          "urlbarTipsExperiment.tipShownCount",
          "redirect",
          1
        );

        TelemetryTestUtils.assertEvents([
          {
            category: "urlbar",
            method: "engagement",
            object: "click",
            value: "typed",
            extra: {
              elapsed: val => parseInt(val) > 0,
              numChars: "0",
              selIndex: "0",
              selType: "tip",
            },
          },
        ]);
      });
    });
  });
});

// Checks engagement event telemetry and experiment telemetry on the control
// branch after the onboard tip would have been shown.
add_task(async function telemetryControlOnboard() {
  Services.telemetry.clearScalars();
  Services.telemetry.clearEvents();
  await withStudy({ branch: BRANCHES.CONTROL }, async () => {
    await withAddon(async () => {
      let tab = await BrowserTestUtils.openNewForegroundTab({
        gBrowser,
        url: "about:newtab",
        waitForLoad: false,
      });
      await checkTip(window, TIPS.NONE);
      BrowserTestUtils.removeTab(tab);

      // Shown-count telemetry should still be incremented.
      TelemetryTestUtils.assertKeyedScalar(
        TelemetryTestUtils.getProcessScalars("dynamic", true),
        "urlbarTipsExperiment.tipShownCount",
        "onboard",
        1
      );

      // Trigger an abandonment event just to make sure engagement event
      // telemetry is recorded on the control branch.
      await UrlbarTestUtils.promiseAutocompleteResultPopup({
        window,
        value: "test",
        waitForFocus,
        fireInputEvent: true,
      });
      await UrlbarTestUtils.promisePopupClose(window, () => {
        gURLBar.blur();
      });
      TelemetryTestUtils.assertEvents([
        {
          category: "urlbar",
          method: "abandonment",
          object: "blur",
          value: "typed",
          extra: {
            elapsed: val => parseInt(val) > 0,
            numChars: "4",
          },
        },
      ]);
    });
  });
});

// Checks engagement event telemetry and experiment telemetry on the control
// branch after the redirect tip would have been shown.
add_task(async function telemetryControlRedirect() {
  Services.telemetry.clearScalars();
  Services.telemetry.clearEvents();
  await withStudy({ branch: BRANCHES.CONTROL }, async () => {
    await withAddon(async () => {
      await withDNSRedirect("www.google.com", "/", async url => {
        let tab = await BrowserTestUtils.openNewForegroundTab({
          gBrowser,
          url,
        });
        await checkTip(window, TIPS.NONE);
        BrowserTestUtils.removeTab(tab);

        // Shown-count telemetry should still be incremented.
        TelemetryTestUtils.assertKeyedScalar(
          TelemetryTestUtils.getProcessScalars("dynamic", true),
          "urlbarTipsExperiment.tipShownCount",
          "redirect",
          1
        );

        // Trigger an abandonment event just to make sure engagement event
        // telemetry is recorded on the control branch.
        await UrlbarTestUtils.promiseAutocompleteResultPopup({
          window,
          value: "test",
          waitForFocus,
          fireInputEvent: true,
        });
        await UrlbarTestUtils.promisePopupClose(window, () => {
          gURLBar.blur();
        });
        TelemetryTestUtils.assertEvents([
          {
            category: "urlbar",
            method: "abandonment",
            object: "blur",
            value: "typed",
            extra: {
              elapsed: val => parseInt(val) > 0,
              numChars: "4",
            },
          },
        ]);
      });
    });
  });
});

// The onboarding tip shouldn't be shown on the control branch.
add_task(async function controlNewtab() {
  await withStudy({ branch: BRANCHES.CONTROL }, async () => {
    await withAddon(async () => {
      await checkTab(window, "about:newtab", TIPS.NONE);
    });
  });
});

// The onboarding tip shouldn't be shown on about:home on the control branch.
add_task(async function controlHome() {
  await withStudy({ branch: BRANCHES.CONTROL }, async () => {
    await withAddon(async () => {
      await checkTab(window, "about:home", TIPS.NONE);
    });
  });
});

// The redirect tip shouldn't be shown for www.google.com on the control branch.
add_task(async function controlGoogle() {
  await setDefaultEngine("Google");
  await withStudy({ branch: BRANCHES.CONTROL }, async () => {
    await withAddon(async () => {
      await withDNSRedirect("www.google.com", "/", async url => {
        await checkTab(window, url, TIPS.NONE);
      });
    });
  });
});

add_task(async function unenrollAfterInstall() {
  await withStudy({ branch: BRANCHES.TREATMENT }, async study => {
    await withAddon(async () => {
      await Promise.all([
        awaitAddonMessage("unenrolled"),
        AddonStudies.markAsEnded(study),
      ]);
      await checkTab(window, "about:newtab", TIPS.NONE);
    });
  });
});

add_task(async function unenrollBeforeInstall() {
  await withStudy({ branch: BRANCHES.TREATMENT }, async study => {
    await AddonStudies.markAsEnded(study);
    await withAddon(async () => {
      await checkTab(window, "about:newtab", TIPS.NONE);
    });
  });
});

add_task(async function noBranch() {
  await withStudy({}, async () => {
    await withAddon(async () => {
      await checkTab(window, "about:newtab", TIPS.NONE);
    });
  });
});

add_task(async function unrecognizedBranch() {
  await withStudy({ branch: "bogus" }, async () => {
    await withAddon(async () => {
      await checkTab(window, "about:newtab", TIPS.NONE);
    });
  });
});

async function checkTip(win, expectedTip, closeView = true) {
  if (!expectedTip) {
    // Wait a bit for the tip to not show up.
    // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
    await new Promise(resolve => setTimeout(resolve, 3 * SHOW_TIP_DELAY_MS));
    Assert.ok(!win.gURLBar.view.isOpen);
    return;
  }

  // Wait for the view to open, and then check the tip result.
  await UrlbarTestUtils.promisePopupOpen(win, () => {});
  Assert.ok(true, "View opened");
  Assert.equal(UrlbarTestUtils.getResultCount(win), 1);
  let result = await UrlbarTestUtils.getDetailsOfResultAt(win, 0);
  Assert.equal(result.type, UrlbarUtils.RESULT_TYPE.TIP);
  Assert.ok(result.heuristic);
  let name = Services.search.defaultEngine.name;
  let title;
  switch (expectedTip) {
    case TIPS.ONBOARD:
      title =
        `Type less, find more: Search ${name} right from your ` +
        `address bar.`;
      break;
    case TIPS.REDIRECT:
      title =
        `Start your search here to see suggestions from ${name} ` +
        `and your browsing history.`;
      break;
  }
  Assert.equal(result.displayed.title, title);
  Assert.equal(
    result.element.row._elements.get("tipButton").textContent,
    `Okay, Got It`
  );
  Assert.ok(
    BrowserTestUtils.is_hidden(result.element.row._elements.get("helpButton"))
  );

  if (closeView) {
    await UrlbarTestUtils.promisePopupClose(win);
  }
}

async function checkTab(win, url, expectedTip) {
  // BrowserTestUtils.withNewTab always waits for tab load, which hangs on
  // about:newtab for some reason, so don't use it.
  let tab = await BrowserTestUtils.openNewForegroundTab({
    gBrowser: win.gBrowser,
    url,
    waitForLoad: url != "about:newtab",
  });
  await checkTip(win, expectedTip);
  BrowserTestUtils.removeTab(tab);
}

/**
 * This lets us visit the www.google.com (for example) and have it redirect to
 * our test HTTP server instead of visiting the actual site.
 */
async function withDNSRedirect(domain, path, callback) {
  // Some domains have special security requirements, like www.bing.com.  We
  // need to override them to successfully load them.  This part is adapted from
  // testing/marionette/cert.js.
  const certOverrideService = Cc[
    "@mozilla.org/security/certoverride;1"
  ].getService(Ci.nsICertOverrideService);
  Services.prefs.setBoolPref(
    "network.stricttransportsecurity.preloadlist",
    false
  );
  Services.prefs.setIntPref("security.cert_pinning.enforcement_level", 0);
  certOverrideService.setDisableAllSecurityChecksAndLetAttackersInterceptMyData(
    true
  );

  // Now set network.dns.localDomains to redirect the domain to localhost and
  // set up an HTTP server.
  Services.prefs.setCharPref("network.dns.localDomains", domain);

  let server = new HttpServer();
  server.registerPathHandler(path, (req, resp) => {
    resp.write(`Test! http://${domain}${path}`);
  });
  server.start(-1);
  server.identity.setPrimary("http", domain, server.identity.primaryPort);
  let url = `http://${domain}:${server.identity.primaryPort}${path}`;

  await callback(url);

  // Reset network.dns.localDomains and stop the server.
  Services.prefs.clearUserPref("network.dns.localDomains");
  await new Promise(resolve => server.stop(resolve));

  // Reset the security stuff.
  certOverrideService.setDisableAllSecurityChecksAndLetAttackersInterceptMyData(
    false
  );
  Services.prefs.clearUserPref("network.stricttransportsecurity.preloadlist");
  Services.prefs.clearUserPref("security.cert_pinning.enforcement_level");
  const sss = Cc["@mozilla.org/ssservice;1"].getService(
    Ci.nsISiteSecurityService
  );
  sss.clearAll();
  sss.clearPreloads();
}

async function setDefaultEngine(name) {
  let engine = (await Services.search.getEngines()).find(e => e.name == name);
  Assert.ok(engine);
  await Services.search.setDefault(engine);
}
