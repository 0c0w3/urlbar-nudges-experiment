/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// The possible study branches.
const BRANCHES = {
  CONTROL: "control",
  TREATMENT: "treatment",
};

// The possible tips to show.
const TIPS = {
  NONE: 0,
  ONBOARD: 1,
  REDIRECT: 2,
};

// Maps engine names to their homepages.  We show the redirect tip on these.
const SUPPORTED_ENGINES = new Map([
  ["Google", ["www.google.com", "www.google.com/webhp"]],
  ["Bing", ["www.bing.com"]],
  ["DuckDuckGo", ["duckduckgo.com", "start.duckduckgo.com"]],
]);

// The maximum number of times we'll show a tip across all sessions.
const MAX_SHOWN_COUNT = 4;

// Amount of time to wait before showing a tip after selecting a tab or
// navigating to a page where we should show a tip.
const SHOW_TIP_DELAY_MS = 200;

// We won't show a tip if the browser has been updated in the past
// LAST_UPDATE_THRESHOLD_MS.
const LAST_UPDATE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// Our browser.urlbar provider name.
const URLBAR_PROVIDER_NAME = "tips";

// storage[STORAGE_KEY_SHOWN_COUNT] is the shown count.
const STORAGE_KEY_SHOWN_COUNT = "tipsShownCount";

// The current study branch.
let studyBranch;

// The tip we should currently show.
let currentTip = TIPS.NONE;

// Whether we've shown a tip in the current session.
let showedTipInCurrentSession = false;

// Our copy of browser.storage.local.  We store the number of times we've shown
// a tip across all sessions.
let storage;

/**
 * browser.tabs.onTabActivated listener.  Checks to see whether we should show a
 * tip.
 */
function onTabActivated(info) {
  maybeShowTipForTab(info.tabId);
}

/**
 * browser.webNavigation.onCompleted listener.  Called when a page has finished
 * loading.  Checks to see whether we should show a tip.
 */
async function onWebNavigation(details) {
  // frameId == 0 for top-level loads.  We also exclude about:newtab because
  // sometimes when a new tab is opened, this function is called *while*
  // onTabActivated/maybeShowTipForTab are in the middle of running (but not
  // always), and that causes no tip or an incorrect tip to be shown (at least
  // during the test).  So we'll capture new tabs by onTabActivated only.
  if (details.frameId == 0 && details.url != "about:newtab") {
    let tab = await browser.tabs.get(details.tabId);
    if (tab.active) {
      maybeShowTipForTab(details.tabId);
    }
  }
}

/**
 * Determines whether we should show a tip for the current tab.  Sets currentTip
 * and calls browser.urlbar.search as appropriate.  Once this calls search, our
 * browser.urlbar.onBehaviorRequested and browser.urlbar.onResultsRequested
 * listeners take it from there.
 *
 * @param {number} tabID
 *   The ID of the current tab.
 */
async function maybeShowTipForTab(tabID) {
  let tab = await browser.tabs.get(tabID);

  // We show only one tip per session, so if we've shown one already, stop.
  if (showedTipInCurrentSession) {
    return;
  }

  // Get the number of times we've shown a tip over all sessions.  If it's the
  // max, don't show it again.
  if (!storage) {
    storage = await browser.storage.local.get(STORAGE_KEY_SHOWN_COUNT);
    if (!(STORAGE_KEY_SHOWN_COUNT in storage)) {
      storage[STORAGE_KEY_SHOWN_COUNT] = 0;
    }
  }
  if (storage[STORAGE_KEY_SHOWN_COUNT] >= MAX_SHOWN_COUNT) {
    return;
  }

  // Don't show a tip if the browser is already showing some other notification.
  if (await browser.experiments.urlbar.isBrowserShowingNotification()) {
    return;
  }

  // Don't show a tip if the browser has been updated recently.
  let date = await browser.experiments.urlbar.lastBrowserUpdateDate();
  if (Date.now() - date <= LAST_UPDATE_THRESHOLD_MS) {
    return;
  }

  // Determine which tip we should show for the tab.
  let tip;
  let telemetryKey;
  let isNewtab = ["about:newtab", "about:home"].includes(tab.url);
  let isSearchHomepage = !isNewtab && (await isDefaultEngineHomepage(tab.url));
  if (isNewtab) {
    tip = TIPS.ONBOARD;
    telemetryKey = "onboard";
  } else if (isSearchHomepage) {
    tip = TIPS.REDIRECT;
    telemetryKey = "redirect";
  } else {
    // No tip.
    return;
  }

  // At this point, we're showing a tip.

  showedTipInCurrentSession = true;

  // Store the new shown count.
  storage[STORAGE_KEY_SHOWN_COUNT]++;
  await browser.storage.local.set(storage);

  // Update shown-count telemetry.
  browser.telemetry.keyedScalarAdd(
    "urlbarTipsExperiment.tipShownCount",
    telemetryKey,
    1
  );

  if (studyBranch == BRANCHES.TREATMENT) {
    // Start a search.  Our browser.urlbar.onBehaviorRequested and
    // browser.urlbar.onResultsRequested listeners will be called.  We do this
    // on a timeout because sometimes urlbar.value will be set *after* our
    // search call (due to an onLocationChange), and we want it to remain empty.
    setTimeout(() => {
      currentTip = tip;
      browser.urlbar.search("", { focus: tip == TIPS.ONBOARD });
    }, SHOW_TIP_DELAY_MS);
  }
}

/**
 * browser.urlbar.onBehaviorRequested listener.
 */
async function onBehaviorRequested(query) {
  return currentTip ? "restricting" : "inactive";
}

/**
 * browser.urlbar.onResultsRequested listener.
 */
async function onResultsRequested(query) {
  let tip = currentTip;
  currentTip = TIPS.NONE;

  let engines = await browser.search.get();
  let defaultEngine = engines.find(engine => engine.isDefault);

  let result = {
    type: "tip",
    source: "local",
    heuristic: true,
    payload: {
      icon: defaultEngine.favIconUrl,
      buttonText: "Okay, Got It",
    },
  };

  switch (tip) {
    case TIPS.ONBOARD:
      result.payload.text =
        `Type less, find more: Search ${defaultEngine.name} ` +
        `right from your address bar.`;
      break;
    case TIPS.REDIRECT:
      result.payload.text =
        `Start your search here to see suggestions from ` +
        `${defaultEngine.name} and your browsing history.`;
      break;
  }

  return [result];
}

/**
 * browser.urlbar.onResultPicked listener.  Called when a tip button is picked.
 */
async function onResultPicked(payload) {
  browser.urlbar.focus();

  // The user clicked the "Okay, Got It" button.  We shouldn't show a tip again
  // in any session.  Set the shown count to the max.
  storage[STORAGE_KEY_SHOWN_COUNT] = MAX_SHOWN_COUNT;
  await browser.storage.local.set(storage);
}

/**
 * browser.webNavigation.onBeforeNavigate listener.  Called when a new
 * navigation starts.  We use this to close the urlbar view, which is necessary
 * when the input isn't focused.
 */
async function onBeforeNavigate(details) {
  // frameId == 0 for top-level loads.
  if (details.frameId == 0) {
    let tab = await browser.tabs.get(details.tabId);
    if (tab.active) {
      browser.urlbar.closeView();
    }
  }
}

/**
 * browser.windows.onFocusChanged listener.  We use this to close the urlbar
 * view, which is necessary when the input isn't focused.
 */
function onWindowFocusChanged() {
  browser.urlbar.closeView();
}

/**
 * Resets all the state we set on enrollment in the study.
 */
async function unenroll() {
  await browser.tabs.onActivated.removeListener(onTabActivated);
  await browser.webNavigation.onCompleted.removeListener(onWebNavigation);
  await browser.urlbar.onBehaviorRequested.removeListener(onBehaviorRequested);
  await browser.urlbar.onResultsRequested.removeListener(onResultsRequested);
  await browser.urlbar.onResultPicked.removeListener(onResultPicked);
  await browser.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
  await browser.windows.onFocusChanged.removeListener(onWindowFocusChanged);
  await browser.experiments.urlbar.engagementTelemetry.clear({});
  sendTestMessage("unenrolled");
}

/**
 * Sets up all appropriate state for enrollment in the study.
 */
async function enroll() {
  await browser.normandyAddonStudy.onUnenroll.addListener(async () => {
    await unenroll();
  });

  // Listen for tab selection.
  await browser.tabs.onActivated.addListener(onTabActivated);

  // Listen for page loads.
  await browser.webNavigation.onCompleted.addListener(onWebNavigation);

  // Add urlbar listeners.
  await browser.urlbar.onBehaviorRequested.addListener(
    onBehaviorRequested,
    URLBAR_PROVIDER_NAME
  );
  await browser.urlbar.onResultsRequested.addListener(
    onResultsRequested,
    URLBAR_PROVIDER_NAME
  );
  await browser.urlbar.onResultPicked.addListener(
    onResultPicked,
    URLBAR_PROVIDER_NAME
  );

  // When the urlbar is blurred, it automatically closes the view.  For the
  // redirect tip, we open the view without focusing the urlbar, which means
  // that it will remain open in more cases than usual.  The urlbar also closes
  // the view when the user clicks outside the view and when tabs are selected.
  // We need to handle when navigation happens (without a click) and when the
  // window focus changes.
  await browser.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
  await browser.windows.onFocusChanged.addListener(onWindowFocusChanged);

  // Enable urlbar engagement event telemetry.
  await browser.experiments.urlbar.engagementTelemetry.set({ value: true });

  // Register scalar telemetry.  We increment a keyed scalar when we show a tip.
  browser.telemetry.registerScalars("urlbarTipsExperiment", {
    tipShownCount: {
      kind: "count",
      keyed: true,
      record_on_release: true,
    },
  });

  sendTestMessage("enrolled");
}

/**
 * Checks if the given URL is the homepage of the current default search engine.
 * Returns false if the default engine is not listed in SUPPORTED_ENGINES.
 * @param {string} urlStr
 *   The URL to check, in string form.
 *
 * @returns {boolean}
 */
async function isDefaultEngineHomepage(urlStr) {
  let engines = await browser.search.get();
  let defaultEngine = engines.find(engine => engine.isDefault);
  if (!defaultEngine) {
    return false;
  }

  let homepages = SUPPORTED_ENGINES.get(defaultEngine.name);
  if (!homepages) {
    return false;
  }

  // The URL object throws if the string isn't a valid URL.
  let url;
  try {
    url = new URL(urlStr);
  } catch (e) {
    return false;
  }
  // Strip protocol, query parameters, and trailing slash.
  urlStr = url.hostname.concat(url.pathname);
  if (urlStr.endsWith("/")) {
    urlStr = urlStr.slice(0, -1);
  }

  return homepages.includes(urlStr);
}

/**
 * Logs a debug message, which the test harness interprets as a message the
 * add-on is sending to the test.  See head.js for info.
 *
 * @param {string} msg
 *   The message.
 */
function sendTestMessage(msg) {
  console.debug(browser.runtime.id, msg);
}

(async function main() {
  // As a development convenience, act like we're enrolled in the treatment
  // branch if we're a temporary add-on.  onInstalled with details.temporary =
  // true will be fired in that case.  Add the listener now before awaiting the
  // study below to make sure we don't miss the event.
  let installPromise = new Promise(resolve => {
    browser.runtime.onInstalled.addListener(details => {
      resolve(details.temporary);
    });
  });

  // If we're enrolled in the study, set everything up, and then we're done.
  let study = await browser.normandyAddonStudy.getStudy();
  if (study) {
    // Sanity check the study.  This conditional should always be true.
    if (study.active && Object.values(BRANCHES).includes(study.branch)) {
      studyBranch = study.branch;
      await enroll();
    }
    sendTestMessage("ready");
    return;
  }

  // There's no study.  If installation happens, then continue with the
  // development convenience described above.
  installPromise.then(async isTemporaryInstall => {
    if (isTemporaryInstall) {
      console.debug("isTemporaryInstall");
      studyBranch = BRANCHES.TREATMENT;
      await enroll();
    }
    sendTestMessage("ready");
  });
})();
