# Golden Valley Research

Personal Roth IRA tracking site, live at goldenvalleyresearch.com. Tracking starts Oct 21, 2026.

## Daily update (every day, activity or not)

1. In Fidelity, download the **Positions** CSV.
2. In GitHub, open the `data/positions` folder.
3. **Add file → Upload files**, drop the CSV in (keep Fidelity's file name), **Commit changes**.

Netlify rebuilds the site automatically within a minute or two. The site always shows the
newest file, based on the "Date downloaded" line inside it. Keep the old files: each one is a
daily snapshot that will power the performance history later.

## Activity days (buys, sells, contributions)

Upload the Fidelity **Activity/History** CSV into `data/activity` the same way.
(The site doesn't read these yet. That's the next build step.)

## If something goes wrong

If a file can't be read, the Netlify build stops on purpose and the last good version of the
site stays live. Check the deploy log in Netlify for a line starting with `BUILD STOPPED:`.

## How it works

- `netlify.toml` tells Netlify to run `node scripts/build.js` and publish the `site` folder.
- `scripts/build.js` reads the newest file in `data/positions` and writes `site/data/positions.json`.
  The account number is left out of everything published.
- `site/positions/index.html` is the Open Positions page. It reads `positions.json`.
- `site/index.html` is the homepage (currently the "Under Renovation" page).
