/* global process */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const gitbookApiBaseUrl = "https://api.gitbook.com/v1";

loadEnv(resolve(process.cwd(), ".env.local"));
loadEnv(resolve(process.cwd(), "apps/docs/.env.local"));

const apiKey = requiredEnv("GITBOOK_API_KEY");
const organizationId = requiredEnv("GITBOOK_ORG_ID");
const specSlug = process.env.GITBOOK_OPENAPI_SLUG ?? "openstat-api";
const sourceUrl = getOpenApiSourceUrl();

const endpoint = `${gitbookApiBaseUrl}/orgs/${encodeURIComponent(
  organizationId,
)}/openapi/${encodeURIComponent(specSlug)}`;

const response = await fetch(endpoint, {
  method: "PUT",
  headers: {
    accept: "application/json",
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    source: {
      url: sourceUrl,
    },
  }),
});

const responseBody = await readJsonResponse(response);

if (!response.ok) {
  console.error("GitBook OpenAPI sync failed.");
  console.error(JSON.stringify(responseBody, null, 2));
  process.exit(1);
}

console.log(`Synced ${specSlug} from ${sourceUrl}`);
console.log(`GitBook processing state: ${responseBody.processingState}`);

if (responseBody.urls?.app) {
  console.log(`GitBook app URL: ${responseBody.urls.app}`);
}

function getOpenApiSourceUrl() {
  if (process.env.GITBOOK_OPENAPI_SOURCE_URL) {
    return process.env.GITBOOK_OPENAPI_SOURCE_URL;
  }

  if (process.env.OPENSTAT_DOCS_PUBLIC_URL) {
    return new URL("/openapi.json", process.env.OPENSTAT_DOCS_PUBLIC_URL)
      .toString();
  }

  throw new Error(
    [
      "Missing GITBOOK_OPENAPI_SOURCE_URL.",
      "GitBook must fetch OpenAPI from a public URL, not localhost.",
      "Set it to your deployed docs /openapi.json URL, or set OPENSTAT_DOCS_PUBLIC_URL.",
    ].join(" "),
  );
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function loadEnv(path) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = stripQuotes(rawValue);
  }
}

function stripQuotes(value) {
  const startsWithQuote = value.startsWith('"') || value.startsWith("'");
  const endsWithQuote = value.endsWith('"') || value.endsWith("'");

  if (startsWithQuote && endsWithQuote) {
    return value.slice(1, -1);
  }

  return value;
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text,
    };
  }
}
