# Flip Out Games Day — Phase 1 Setup

This is a plain HTML/CSS/JS site — no build tools, no npm install. You just need
to fill in two values, run one SQL script, and push it to GitHub.

## Step 1 — Run the database script

1. Go to your Supabase project dashboard.
2. Click **SQL Editor** in the left sidebar → **New query**.
3. Open the file `sql/phase1_schema.sql` from this folder, copy all of it, and paste it in.
4. Before running, change the last line's name/PIN to whatever you want your own admin login to be:
   ```sql
   insert into players (name, pin, is_admin)
   values ('Admin', '1234', true);
   ```
5. Click **Run**. You should see "Success. No rows returned."

## Step 2 — Connect the app to your Supabase project

1. In Supabase, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key (NOT the `service_role` key — that one must stay secret).
3. Open `js/config.js` in this folder and paste them in:
   ```js
   const SUPABASE_URL = "https://your-project-id.supabase.co";
   const SUPABASE_ANON_KEY = "your-long-anon-key-here";
   ```
4. Save the file.

## Step 3 — Put it on GitHub Pages

1. Create a new **public** repository on GitHub (e.g. `flipout-games-day`).
2. Upload every file/folder in this project into that repo (drag-and-drop on
   GitHub's web UI works fine, or use `git push` if you're comfortable with it).
3. In the repo, go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to "Deploy from a branch",
   branch = `main`, folder = `/ (root)`. Click **Save**.
5. Wait ~1 minute, then GitHub will show you a live URL like:
   `https://yourusername.github.io/flipout-games-day/`

## Step 4 — Install it on an iPhone like an app

1. Open that URL in **Safari** on an iPhone (must be Safari, not Chrome).
2. Tap the **Share** icon → **Add to Home Screen**.
3. It now opens full-screen from the Home Screen, no browser bar — feels like a real app, completely free.

## Step 5 — Log in and try it

1. Open the app, log in with the admin name + PIN you set in Step 1.
2. You'll see an **Admin** tab at the bottom — use it to add your first team and a couple of test workers.
3. Log out, log back in as one of those test workers to confirm the flow works both ways.

## What's in Phase 1

- Name + PIN login (no email needed), session remembered on the device
- Admin can add workers (name + PIN) and teams
- Everyone can see a basic team list
- Christmas/Flip Out themed shell, works well on iPhone, installable as a Home Screen app

## What's NOT in yet (coming in later phases)

Team approval workflow, logo uploads, player numbers, stats, cheers, leaderboards,
weather/sunscreen/water challenges, t-shirt sizing, beach voting, timetable, countdowns,
team leader elections.

## One honest security note

Because login uses a simple name+PIN system instead of Supabase's built-in
authentication, the database rules in Phase 1 are set fairly open (anyone with
your public "anon key" — which is visible in your website's code, that's normal —
can read/write the teams and players tables). This is fine for a low-stakes,
short-lived internal party app, but it does mean a technically-savvy person
could poke at your database directly. If that's a concern, let me know and I
can tighten this up with a proper verification layer in a later phase.

## If something breaks

- Blank page / nothing loads → check the browser console (Safari: Settings →
  Advanced → turn on Web Inspector, then connect to a Mac) for a red error —
  it's almost always a typo in `js/config.js`.
- "No match for that name + PIN" → double check the name spelling matches
  exactly what's in the `players` table (PIN must match exactly too).
- Admin tab missing → that login's `is_admin` is not set to `true` in Supabase.
