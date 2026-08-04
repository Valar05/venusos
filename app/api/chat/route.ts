import {
  getVoiceStatus,
  inferVeniceReply,
  VoiceUnboundError,
} from "../../../server/inference";
import { ownerFromRequest, ownerRequiredResponse } from "../../../server/owner";
import { rejectCrossSiteMutation } from "../../../server/security";
import {
  appendMessage,
  buildSystemPrompt,
  createThread,
  ensureVenice,
  getOwnedThread,
  getThreadMessages,
} from "../../../server/store";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;
  const owner = await ownerFromRequest(request);
  if (!owner) return ownerRequiredResponse();
  let storedMessage: Awaited<ReturnType<typeof appendMessage>> | null = null;
  let threadId = "";

  try {
    const body = (await request.json()) as {
      content?: unknown;
      threadId?: unknown;
      clientMessageId?: unknown;
      allowInference?: unknown;
    };
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const clientMessageId =
      typeof body.clientMessageId === "string" ? body.clientMessageId.trim() : "";
    if (!content || content.length > 20_000 || !clientMessageId || clientMessageId.length > 180) {
      return Response.json({ error: "A bounded message and client receipt id are required." }, { status: 400 });
    }

    await ensureVenice(owner);
    const requestedThread = typeof body.threadId === "string" ? body.threadId : "";
    const existingThread = requestedThread
      ? await getOwnedThread(owner, requestedThread)
      : null;
    const thread = existingThread ?? (await createThread(owner, content.slice(0, 72)));
    threadId = thread.id;
    storedMessage = await appendMessage(owner, {
      threadId,
      role: "user",
      content,
      clientMessageId,
      grounding: "user-source",
    });

    if (body.allowInference !== true) {
      return Response.json(
        {
          stored: true,
          thread,
          message: storedMessage,
          reply: null,
          inference: "not_requested",
        },
        { status: 202, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!(await getVoiceStatus()).configured) throw new VoiceUnboundError();

    const [systemPrompt, history] = await Promise.all([
      buildSystemPrompt(owner),
      getThreadMessages(owner, threadId),
    ]);
    const answer = await inferVeniceReply(
      systemPrompt,
      history.slice(-24).map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      })),
    );
    const reply = await appendMessage(owner, {
      threadId,
      role: "assistant",
      content: answer.content,
      clientMessageId: `${clientMessageId}:reply`,
      grounding: "source-grounded-generation",
      model: answer.model,
    });
    return Response.json({ stored: true, thread, message: storedMessage, reply });
  } catch (error) {
    if (error instanceof VoiceUnboundError) {
      return Response.json(
        {
          code: "voice_unbound",
          error: error.message,
          stored: Boolean(storedMessage),
          threadId,
          message: storedMessage,
        },
        { status: 503 },
      );
    }
    return Response.json(
      {
        code: storedMessage ? "voice_bridge_failed" : "storage_failed",
        error: error instanceof Error ? error.message : "Conversation failed.",
        stored: Boolean(storedMessage),
        threadId,
        message: storedMessage,
      },
      { status: storedMessage ? 502 : 500 },
    );
  }
}
