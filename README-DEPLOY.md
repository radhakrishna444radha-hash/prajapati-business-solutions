# How to put this website online (beginner guide)

You need two free accounts: **GitHub** (stores your files) and **Netlify** (shows the website to the world).
Screens and button names change sometimes, so the wording may differ a little.

## Part 1: Put the files on GitHub
1. Go to github.com and sign up or log in.
2. Click the **+** at the top right, then **New repository**.
3. Repository name: `pbs-website`. Choose **Private**. Click **Create repository**.
4. On the new page, click **uploading an existing file**.
5. Open your extracted `pbs-website` folder. Select **everything inside it** (not the folder itself), including the `assets` folder and the files `_headers`, `robots.txt` and `sitemap.xml`. Drag them into the GitHub page.
6. Wait until all files finish uploading. Scroll down and click **Commit changes**.
7. Check that you can see `index.html`, `_headers` and the `assets` folder in the repository.

## Part 2: Put it online with Netlify
1. Go to netlify.com and sign up with your GitHub account.
2. Click **Add new site** (or **Add new project**), then **Import an existing project**, then **GitHub**.
3. Allow Netlify to access your `pbs-website` repository and select it.
4. Leave **Build command** empty. Set **Publish directory** to `.` (a single dot), or leave it empty if it is already blank.
5. Click **Deploy**. After a minute you get a link like `something.netlify.app`.
6. Open the link and click through every page.

## Part 3: After the first deploy
1. Open `sitemap.xml` and `robots.txt` and replace `YOUR-SITE-URL` with your real site address, for example `something.netlify.app` (without `https://`, it is already there).
2. Upload the changed files to GitHub: **Add file > Upload files**, then **Commit changes**.
3. Open your site, press F12, click **Console**. If you see red errors mentioning "Content Security Policy", copy them and send them to me.

## Part 4: Connect the enquiry form (only when you are ready)
The form stays in a safe "not connected" state until you do this. It will never say "sent" unless your Edge Function confirms it.
1. In Supabase, open **Project Settings > API**. Copy the **Project URL** and the **anon / publishable** key. Do NOT copy the `service_role` key anywhere.
2. Open `assets/js/config.js` in Notepad. Paste the URL between the quotes after `SUPABASE_URL:` and the public key after `SUPABASE_ANON_KEY:`. Save.
3. Open `_headers` in Notepad. Replace `https://YOUR-PROJECT-REF.supabase.co` with your exact Project URL. Save. (If you skip this, the browser blocks the request and the form shows a "could not reach the server" message.)
4. Upload `config.js` and `_headers` to GitHub the same way as before and wait for Netlify to redeploy.
5. Open the enquiry page and send **one test enquiry** with your own details. Then check that it appears in your Supabase `leads` table. Only then is the form really connected.
6. If it fails, press F12 > **Console** and send me the red error text (never any keys). A CORS error means your Edge Function must allow your website address.

## Updating the site later
Upload the new or changed files to GitHub (**Add file > Upload files**; same file names replace the old ones). Netlify updates the site by itself in about a minute.

## Important
- Never put passwords or secret keys in any file or in chat.
- `assets/js/config.js` may contain only the Supabase Project URL and the public anon/publishable key.
- Before public launch, read `SPAM-PROTECTION.md`.
