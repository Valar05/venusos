import { ownerFromRequest, ownerRequiredResponse } from "../../../server/owner";
import { getOwnedThread, getThreadMessages } from "../../../server/store";

export async function GET(request: Request) {
  const owner = await ownerFromRequest(request);
  if (!owner) return ownerRequiredResponse();
  const threadId = new URL(request.url).searchParams.get("threadId")?.trim();
  if (!threadId) return Response.json({ error: "threadId is required." }, { status: 400 });
  const thread = await getOwnedThread(owner, threadId);
  if (!thread) return Response.json({ error: "Thread not found." }, { status: 404 });
  return Response.json(
    { thread, messages: await getThreadMessages(owner, threadId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
