/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const BRANCHES = {
  CONTROL: "control",
  TREATMENT: "treatment",
};

// The example.com domains are for testing. Consumers of isDefaultEngineHomepage
// should check that the active hostname is not example.com before displaying
// a search tip.
const SUPPORTED_ENGINES = new Map([
  ["Google", ["www.google.com", "www.google.com/webhp", "example.com/google"]],
  ["Bing", ["www.bing.com", "example.com/bing"]],
  ["DuckDuckGo", ["duckduckgo.com", "start.duckduckgo.com", "example.com/ddg"]],
]);

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

/**
 * Resets all the state we set on enrollment in the study.
 *
 * @param {bool} isTreatmentBranch
 *   True if we were enrolled on the treatment branch, false if control.
 */
async function unenroll(isTreatmentBranch) {
  //XXX Handle unenrollment here.

  sendTestMessage("unenrolled");
}

/**
 * Sets up all appropriate state for enrollment in the study.
 *
 * @param {bool} isTreatmentBranch
 *   True if we are enrolling on the treatment branch, false if control.
 */
async function enroll(isTreatmentBranch) {
  await browser.normandyAddonStudy.onUnenroll.addListener(async () => {
    await unenroll(isTreatmentBranch);
  });

  // Enable urlbar engagement event telemetry.
  await browser.urlbar.engagementTelemetry.set({ value: true });

  //XXX Handle enrollment here.

  if (isTreatmentBranch) {
    //XXX Handle enrollment in the treatment branch here.
  }

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
  } catch(e) {
    return false;
  }
  // Strip protocol, query parameters, and trailing slash.
  urlStr = url.hostname.concat(url.pathname);
  if (urlStr.endsWith("/")) {
    urlStr = urlStr.slice(0, -1);
  }

  return homepages.includes(urlStr);
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
      await enroll(study.branch == BRANCHES.TREATMENT);
    }
    sendTestMessage("ready");
    return;
  }

  // There's no study.  If installation happens, then continue with the
  // development convenience described above.
  installPromise.then(async isTemporaryInstall => {
    if (isTemporaryInstall) {
      console.debug("isTemporaryInstall");
      await enroll(true);
    }
    sendTestMessage("ready");
  });
})();

async function onTabUpdated(tabId, changeInfo, tabInfo) {
  if (changeInfo.status != "complete") {
    return;
  }
  await isDefaultEngineHomepage(tabInfo.url).then(function(isHomepage) {
    sendTestMessage("Page is engine homepage: " + isHomepage);
    if (isHomepage && new URL(tabInfo.url).hostname != "example.com") {
      // TODO: Display nudge.
    }
  });
}

browser.tabs.onUpdated.addListener(onTabUpdated);
