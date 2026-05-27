const defaultApiUrl = "http://localhost:4000";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiUrl = process.env.OPENSTAT_API_URL ?? defaultApiUrl;
  const openApiUrl = new URL("/openapi.json", apiUrl);

  const response = await fetch(openApiUrl, {
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return Response.json(
      {
        error: {
          code: "OPENAPI_FETCH_FAILED",
          message: `Unable to fetch OpenAPI spec from ${openApiUrl.toString()}`,
        },
      },
      {
        status: 502,
      },
    );
  }

  const spec = await response.json();

  return Response.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
