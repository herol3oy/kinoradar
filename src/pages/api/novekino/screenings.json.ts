import type { APIRoute } from "astro";
import { getNovekinoLiveScreenings, parseNovekinoScreeningIds } from "../../../server/novekino.ts";

const jsonHeaders = { "Content-Type": "application/json" };

export const GET: APIRoute = async ({ request }) => {
  let ids: string[];
  try {
    ids = parseNovekinoScreeningIds(new URL(request.url).searchParams.get("ids"));
  } catch {
    return new Response(JSON.stringify({ error: "Invalid screening IDs" }), {
      status: 400,
      headers: { ...jsonHeaders, "Cache-Control": "no-store" },
    });
  }

  try {
    return new Response(JSON.stringify(await getNovekinoLiveScreenings(ids)), {
      status: 200,
      headers: { ...jsonHeaders, "Cache-Control": "public, max-age=30" },
    });
  } catch (error) {
    console.error(JSON.stringify({
      message: "NoveKino live screening lookup failed",
      screeningIds: ids,
      error: error instanceof Error ? error.message : String(error),
    }));
    return new Response(JSON.stringify({ error: "NoveKino live data unavailable" }), {
      status: 502,
      headers: { ...jsonHeaders, "Cache-Control": "no-store" },
    });
  }
};
