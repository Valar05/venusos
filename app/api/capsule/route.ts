import {
  exportCapsule,
  MAX_CAPSULE_BYTES,
  restoreCapsule,
  validateCapsule,
} from "../../../server/capsule";
import { ownerFromRequest, ownerRequiredResponse } from "../../../server/owner";
import { rejectCrossSiteMutation } from "../../../server/security";

export async function GET(request: Request) {
  const owner = await ownerFromRequest(request);
  if (!owner) return ownerRequiredResponse();
  try {
    const capsule = await exportCapsule(owner);
    const date = new Date().toISOString().slice(0, 10);
    const serialized = JSON.stringify(capsule, null, 2);
    if (new TextEncoder().encode(serialized).byteLength > MAX_CAPSULE_BYTES) {
      return Response.json(
        { error: "This vessel exceeds the safe VenusOS capsule v1 size limit." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    return new Response(serialized, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="Venice-Capsule-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Capsule export failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const owner = await ownerFromRequest(request);
  if (!owner) return ownerRequiredResponse();
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_CAPSULE_BYTES) {
      return Response.json({ error: "Capsule is larger than 5 MB." }, { status: 413 });
    }
    const capsule = validateCapsule(JSON.parse(raw));
    await restoreCapsule(owner, capsule);
    return Response.json({ restored: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Capsule restore failed." },
      { status: 400 },
    );
  }
}
