# Urlbar Nudges Experiment Extension

This is the extension for the urlbar nudges add-on experiment. When installed,
Firefox will show a "nudge" or "tip" in the urlbar view in certain situations
that informs the user they can search directly from the urlbar.

[Bug 1568594] is the meta bug that tracks this experiment.

[Bug 1568594]: https://bugzilla.mozilla.org/show_bug.cgi?id=1568594

## Running

You can use [web-ext] or [about:debugging]. Use web-ext while developing and
about:debugging if you're loading the extension as a one-off for some
reason. Both will load the add-on as a temporary add-on, so you'll need to use
Firefox Nightly, Developer Edition, or any other Firefox build that gives
privileges to temporarily installed add-ons.

[about:debugging]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Debugging

## Building

Use [web-ext] to build the add-on zip file.

## Testing

The tests directory contains a browser chrome mochitest and a head.js. The
head.js implements a simple framework for testing Normandy experiment add-on
files.

The requirements above for running the add-on apply to testing it, too. You'll
need either a Mozilla-signed version of the add-on; or Firefox Nightly,
Developer Edition, or any other Firefox build that gives privileges to
temporarily installed add-ons.

To run the test in a particular version of Firefox, you'll need to clone the
repo from which your Firefox was built. If you're testing in Nightly, you'll
need [mozilla-central]. If you're testing in Developer Edition or Beta, you'll
need [mozilla-beta].

Then:

1. `cd` into your example-addon-experiment clone.
2. Copy tests/* into srcdir/testing/extensions, where *srcdir* is the top-level
   directory of your Firefox repo:

       $ cp -R tests/* srcdir/testing/extensions

3. Build the add-on zip file using web-ext as described above:

       $ web-ext build

   Or use a signed copy of the zip file.

4. Copy the zip file into srcdir/testing/extensions/tests/browser:

       $ cp web-ext-artifacts/example_addon_experiment-1.0.0.zip srcdir/testing/extensions/tests/browser

5. Update `EXPECTED_ADDON_SIGNED_STATE` as necessary in
   srcdir/testing/extensions/tests/browser/browser_test.js.  If your zip file is
   unsigned, its value should be `AddonManager.SIGNEDSTATE_MISSING`. If it's
   signed, it should be `AddonManager.SIGNEDSTATE_PRIVILEGED`.

6. `cd` into your srcdir.
7. Run the test using mach:

       $ ./mach mochitest -f browser --appname <path to Firefox binary> testing/extensions/tests/browser/browser_test.js

   If your Firefox repo itself contains the Firefox binary (because you ran
   `mach build`), you can omit the `--appname` argument.

   If mach doesn't find the test, remove your objdir, `mach build`, and try
   again from step 1. (There's got to be a better way…)

[mozilla-central]: http://hg.mozilla.org/mozilla-central/
[mozilla-beta]: https://hg.mozilla.org/releases/mozilla-beta/

## Linting

This project uses the linting rules from mozilla-central. From your
example-addon-experiment directory, run:

    $ npm install
    $ npx eslint .
