# Google settings in Infisical

Ledger's Google settings live in [Infisical](https://infisical.com), not in the repo or in
Cloudflare. Infisical hands them to the build, and Vite bakes them into the JavaScript bundle.

| Name                    | dev                                | prod                                   |
| ----------------------- | ---------------------------------- | -------------------------------------- |
| `VITE_DATA_SOURCE`      | `google`                           | `google`                               |
| `VITE_GOOGLE_CLIENT_ID` | OAuth client allowing localhost    | OAuth client allowing the live site    |
| `VITE_GOOGLE_API_KEY`   | Picker key restricted to localhost | Picker key restricted to the live site |

None of these is a true secret: the client ID and API key end up in every visitor's browser, and
are protected by their origin and API restrictions in Google Cloud (see
[GOOGLE_SETUP.md](GOOGLE_SETUP.md)). Infisical is here so they are kept in one place, per
environment, and never committed. The one real secret is the machine identity's client secret,
which only Cloudflare holds.

## 1. Set up the Infisical project

1. Sign in at <https://app.infisical.com> and create a project called `Ledger` (Secrets
   Management). It comes with `dev`, `staging` and `prod` environments; Ledger uses `dev` and `prod`.
2. In **dev**, add the three secrets above with the localhost values. In **prod**, add them with
   the production values.
3. Copy the **Project ID** from the project's settings.

## 2. Let Cloudflare read `prod`

1. In Infisical, go to **Organization → Access Control → Identities → Create identity**. Name it
   `cloudflare-ledger-build`. Its auth method is **Universal Auth**.
2. Open the identity, under **Universal Auth** click **Add client secret**, and copy the
   **Client ID** and **Client Secret** (shown once).
3. In the `Ledger` project, go to **Access Control → Machine Identities → Add identity**, pick
   `cloudflare-ledger-build`, and give it the **Viewer** role. (For tighter access, make a custom
   role that can only read secrets in `prod`.)
4. In Cloudflare, open **Workers & Pages → ledger → Settings → Build**:
   - **Build command:** `pnpm build:cloudflare`
   - **Variables and secrets** (build-time, not runtime):
     - `INFISICAL_PROJECT_ID` = the project ID (text)
     - `INFISICAL_CLIENT_ID` = the identity's client ID (text)
     - `INFISICAL_CLIENT_SECRET` = the identity's client secret (**secret**)
     - optionally `INFISICAL_ENV` (defaults to `prod`)
   - Remove any `VITE_*` build variables you added earlier; Infisical provides them now.
5. Trigger a new deployment. The build log shows Infisical injecting secrets before `vite build`.

Preview builds use the same build command and therefore the `prod` values, so add the preview
addresses you sign in on to the production OAuth client, and `https://*.<account>.workers.dev/*`
to the production API key.

## 3. Local development

```sh
brew install infisical/get-cli/infisical   # or: npm install -g @infisical/cli
infisical login                            # your own Infisical account
infisical init                             # pick the Ledger project; writes .infisical.json
pnpm dev:google                            # vite with the dev values injected
```

Commit the generated `.infisical.json`: it only holds the project ID. `pnpm dev` keeps working
without Infisical and uses demo data.
