# Setting up Google sign-in

Ledger has no backend. The browser signs the user in with Google and talks to the Sheets API
directly, so all it needs is an **OAuth client ID** and an **API key** from a Google Cloud project.
Both are public by design (they end up in the JavaScript bundle); what protects them is the list of
allowed origins you set below.

This takes about ten minutes, once.

## 1. Create a project

1. Go to <https://console.cloud.google.com/> and sign in.
2. Click the project picker at the top left, then **New project**.
3. Name it `Ledger`, leave the organisation as is, and click **Create**.
4. Make sure the new project is selected in the project picker before continuing.

## 2. Turn on the APIs

1. Open **APIs & Services → Library** (<https://console.cloud.google.com/apis/library>).
2. Search for **Google Sheets API**, open it, click **Enable**.
3. Go back to the library, search for **Google Picker API**, open it, click **Enable**.
4. Do the same for **Google Drive API**. The Picker uses it behind the scenes; access is still limited
   to the files each user picks, because Ledger only asks for the `drive.file` scope.

## 3. Configure the consent screen

1. Open **APIs & Services → OAuth consent screen** (this may be labelled **Google Auth Platform**).
2. Click **Get started**.
3. **App information:** app name `Ledger`, user support email: yours. Click **Next**.
4. **Audience:** choose **External**. Click **Next**.
5. **Contact information:** your email. Click **Next**, tick the agreement, click **Create**.
6. Open **Data access** (or **Scopes**), click **Add or remove scopes**, filter for `drive.file`,
   tick `.../auth/drive.file` ("See, edit, create, and delete only the specific Google Drive files
   you use with this app"), click **Update**, then **Save**.
7. Open **Audience** and, under **Test users**, click **Add users** and add your own Google
   address (and anyone else who should be able to sign in while the app is in testing).

`drive.file` is a "non-sensitive" scope, so you can later click **Publish app** on the Audience page
to let anyone sign in, without Google's verification review.

## 4. Create the OAuth client IDs

Make two clients, one for development and one for production, so each only works on its own
addresses. Both live in the same Google Cloud project.

1. Open **APIs & Services → Credentials** (or **Google Auth Platform → Clients**).
2. Click **Create credentials → OAuth client ID** (or **Create client**).
3. **Application type:** Web application. **Name:** `Ledger dev`.
4. Under **Authorised JavaScript origins**, click **Add URI** and add `http://localhost:5173`.
5. Leave **Authorised redirect URIs** empty (the token flow uses a popup, not redirects).
6. Click **Create** and copy the **Client ID**. It looks like
   `123456789012-abc...apps.googleusercontent.com`. The number at the start is your project
   number, which Ledger also uses for the Picker.
7. Repeat for **Name:** `Ledger prod`, with these origins:
   - `https://finance.georgesheppard.dev`
   - any preview URL you want to sign in on, e.g.
     `https://<branch>-ledger.georgesheppard98.workers.dev` (Google does not accept wildcards, so
     add each one you need)

Origins can take a few minutes to start working after you save them.

## 5. Create the API keys (for the Picker)

Again make two, `Ledger dev` and `Ledger prod`. For each:

1. Still on **Credentials**, click **Create credentials → API key**. Copy the key.
2. Click **Edit API key** (or open the key from the list) and set its **Name**.
3. Under **Application restrictions**, choose **Websites** and add:
   - dev: `http://localhost:5173/*`
   - prod: `https://finance.georgesheppard.dev/*` and `https://*.georgesheppard98.workers.dev/*`
     (API keys do accept wildcards)
   - both: `https://docs.google.com/*` (the Picker runs in an iframe on docs.google.com; without
     this it shows "The API developer key is invalid")
4. Under **API restrictions**, choose **Restrict key** and select **Google Picker API** and
   **Google Drive API**, as Google's
   [Picker guide](https://developers.google.com/workspace/drive/picker/guides/web-picker-sample)
   recommends.
5. Click **Save**.

## 6. Configure Ledger

The client ID and API key are stored in Infisical, one set per environment, and injected at build
time. Follow [SECRETS.md](SECRETS.md).

If you would rather not use Infisical for a quick local test, copy `.env.example` to `.env.local`
(ignored by git), fill it in, and run `pnpm dev`.

## Troubleshooting

- **"Access blocked: This app's request is invalid" / `origin_mismatch`:** the page's origin is not
  in the client's Authorised JavaScript origins (step 4). Check the scheme and port exactly.
- **"Access blocked: Ledger has not completed the Google verification process":** your account is
  not a test user (step 3.7), or publish the app.
- **The picker shows "The API developer key is invalid":** the API key's website restrictions do not
  include this origin or `https://docs.google.com/*`, or the Picker API is not enabled.
- **The picker opens but picking a sheet gives a 404 from Sheets:** the client ID and API key come
  from different projects. Both must be in the same project, since Ledger derives the Picker app ID
  from the client ID.
- **Sign-in window does not appear:** allow pop-ups for the site.
