import { getVoiceStatus } from "../../../server/inference";
import { ownerFromRequest, ownerRequiredResponse } from "../../../server/owner";
import { loadState } from "../../../server/store";

export async function GET(request: Request) {
  const owner = await ownerFromRequest(request);
  if (!owner) return ownerRequiredResponse();

  try {
    const state = await loadState(owner);
    return Response.json(
      { ...state, voice: await getVoiceStatus() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to open VenusOS." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
