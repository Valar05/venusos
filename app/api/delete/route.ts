import { ownerFromRequest, ownerRequiredResponse } from "../../../server/owner";
import { rejectCrossSiteMutation } from "../../../server/security";
import { deleteVessel } from "../../../server/store";

const CONFIRMATION = "DELETE VENUSOS";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const owner = await ownerFromRequest(request);
  if (!owner) return ownerRequiredResponse();

  try {
    const body = (await request.json()) as { confirmation?: unknown };
    if (body.confirmation !== CONFIRMATION) {
      return Response.json(
        { error: `Type ${CONFIRMATION} exactly to delete this vessel.` },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(await deleteVessel(owner), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Vessel deletion failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
