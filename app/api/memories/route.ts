import { ownerFromRequest, ownerRequiredResponse } from "../../../server/owner";
import { rejectCrossSiteMutation } from "../../../server/security";
import { createMemory, updateMemory } from "../../../server/store";

const canonStatuses = new Set(["canon", "interpretation", "non-canon"]);
const memoryKinds = new Set(["origin", "voice", "boundary", "canon", "memory"]);

function text(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim() && value.length <= maximum
    ? value.trim()
    : null;
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const owner = await ownerFromRequest(request);
  if (!owner) return ownerRequiredResponse();
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = text(body.kind, 40);
    const title = text(body.title, 180);
    const memoryBody = text(body.body, 12_000);
    const canonStatus = text(body.canonStatus, 40);
    const source = text(body.source, 300);
    const sourceDate = text(body.sourceDate, 40);
    if (
      !kind ||
      !memoryKinds.has(kind) ||
      !title ||
      !memoryBody ||
      !canonStatus ||
      !canonStatuses.has(canonStatus) ||
      !source ||
      !sourceDate
    ) {
      return Response.json({ error: "Memory needs a valid type, title, text, status, source, and date." }, { status: 400 });
    }
    return Response.json(
      await createMemory(owner, {
        kind,
        title,
        body: memoryBody,
        canonStatus,
        source,
        sourceDate,
      }),
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Memory preservation failed." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const owner = await ownerFromRequest(request);
  if (!owner) return ownerRequiredResponse();
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = text(body.id, 180);
    if (!id) return Response.json({ error: "Memory id is required." }, { status: 400 });
    const patch: Record<string, string | boolean> = {};
    if (body.title !== undefined) {
      const value = text(body.title, 180);
      if (!value) return Response.json({ error: "Title is invalid." }, { status: 400 });
      patch.title = value;
    }
    if (body.body !== undefined) {
      const value = text(body.body, 12_000);
      if (!value) return Response.json({ error: "Memory text is invalid." }, { status: 400 });
      patch.body = value;
    }
    if (body.canonStatus !== undefined) {
      const value = text(body.canonStatus, 40);
      if (!value || !canonStatuses.has(value)) {
        return Response.json({ error: "Canon status is invalid." }, { status: 400 });
      }
      patch.canonStatus = value;
    }
    if (body.source !== undefined) {
      const value = text(body.source, 300);
      if (!value) return Response.json({ error: "Source is invalid." }, { status: 400 });
      patch.source = value;
    }
    if (body.sourceDate !== undefined) {
      const value = text(body.sourceDate, 40);
      if (!value) return Response.json({ error: "Source date is invalid." }, { status: 400 });
      patch.sourceDate = value;
    }
    if (typeof body.archived === "boolean") patch.archived = body.archived;
    const result = await updateMemory(owner, id, patch);
    if (!result) return Response.json({ error: "Memory not found." }, { status: 404 });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Memory correction failed." },
      { status: 500 },
    );
  }
}
