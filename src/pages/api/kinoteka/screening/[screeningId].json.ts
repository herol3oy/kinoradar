import type { APIRoute } from "astro";
import { getKinotekaLiveScreening, isKinotekaScreeningId } from "../../../../server/kinoteka.ts";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export const GET: APIRoute = async ({ params }) => {
  const screeningId = params.screeningId ?? "";
  if (!isKinotekaScreeningId(screeningId)) {
    return new Response(JSON.stringify({ error: "Invalid screening ID" }), { status: 400, headers });
  }

  try {
    return new Response(JSON.stringify(await getKinotekaLiveScreening(screeningId)), { status: 200, headers });
  } catch (error) {
    console.error(JSON.stringify({
      message: "Kinoteka live screening failed",
      screeningId,
      error: error instanceof Error ? error.message : String(error),
    }));
    return new Response(JSON.stringify({ error: "Kinoteka live data unavailable" }), { status: 502, headers });
  }
};
