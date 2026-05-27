# OpenStat Docs

This is the local docs app for OpenStat. It also exposes a server-side
`/openapi.json` route that proxies the backend OpenAPI document from
`OPENSTAT_API_URL`.

## Getting Started

Copy the example environment file:

```sh
cp apps/docs/.env.example apps/docs/.env.local
```

On Windows PowerShell:

```powershell
Copy-Item apps/docs/.env.example apps/docs/.env.local
```

Run the docs app:

```sh
pnpm --filter docs dev
```

Open [http://localhost:3001](http://localhost:3001).

## GitBook OpenAPI Sync

Add these values to `apps/docs/.env.local`:

```env
GITBOOK_API_KEY=your_gitbook_api_key
GITBOOK_ORG_ID=your_gitbook_org_id
GITBOOK_OPENAPI_SLUG=openstat-api
GITBOOK_OPENAPI_SOURCE_URL=https://your-public-docs-origin/openapi.json
OPENSTAT_API_URL=http://localhost:4000
```

`GITBOOK_API_KEY` must stay server-side. Do not prefix it with `NEXT_PUBLIC_`.

GitBook cannot fetch `localhost`, so `GITBOOK_OPENAPI_SOURCE_URL` must be a
public URL. When the docs app is deployed, point it at the deployed
`/openapi.json` route.

Sync the OpenAPI spec to GitBook:

```sh
pnpm --filter docs sync:gitbook:openapi
```

The script calls GitBook's OpenAPI create-or-update endpoint and keeps the spec
slug stable so GitBook API reference blocks can continue to update from the same
source.

## Local OpenAPI Preview

Start the backend on port `4000`, then visit:

```text
http://localhost:3001/openapi.json
```

This route is useful both for local verification and as the public source URL
after deployment.
