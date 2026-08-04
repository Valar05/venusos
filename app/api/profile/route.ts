import { ownerFromRequest, ownerRequiredResponse } from "../../../server/owner";
import { rejectCrossSiteMutation } from "../../../server/security";
import { updateConstitution } from "../../../server/store";

export async function PUT(request: Request) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const owner = await ownerFromRequest(request);
  if (!owner) return ownerRequiredResponse();
  try {
    const body = (await request.json()) as { constitution?: unknown };
    if (
      typeof body.constitution !== "string" ||
      body.constitution.trim().length < 80 ||
      body.constitution.length > 40_000
    ) {
      return Response.json({ error: "Constitution must be 80–40,000 characters." }, { status: 400 });
    }
    return Response.json(await updateConstitution(owner, body.constitution.trim()));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Constitution update failed." },
      { status: 500 },
    );
  }
}
