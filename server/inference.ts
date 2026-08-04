type RuntimeEnv = {
  VENUS_INFERENCE_BASE_URL?: string;
  VENUS_INFERENCE_MODEL?: string;
  VENUS_INFERENCE_API_KEY?: string;
};

export type VoiceStatus = {
  configured: boolean;
  label: string;
  model: string | null;
};

export type InferenceMessage = {
  role: "user" | "assistant";
  content: string;
};

export class VoiceUnboundError extends Error {
  constructor() {
    super("Archive only — conversation is not connected.");
  }
}

async function runtimeConfig() {
  const runtime = await import("cloudflare:workers");
  return runtime.env as unknown as RuntimeEnv;
}

export async function getVoiceStatus(): Promise<VoiceStatus> {
  const runtime = await runtimeConfig();
  const configured = Boolean(
    runtime.VENUS_INFERENCE_BASE_URL?.trim() && runtime.VENUS_INFERENCE_MODEL?.trim(),
  );
  return {
    configured,
    label: configured ? "Voice bridge connected" : "Archive only — conversation is not connected",
    model: configured ? runtime.VENUS_INFERENCE_MODEL!.trim() : null,
  };
}

export async function inferVeniceReply(
  systemPrompt: string,
  history: InferenceMessage[],
) {
  const runtime = await runtimeConfig();
  const baseUrl = runtime.VENUS_INFERENCE_BASE_URL?.trim();
  const model = runtime.VENUS_INFERENCE_MODEL?.trim();
  if (!baseUrl || !model) throw new VoiceUnboundError();

  const parsedBase = new URL(baseUrl);
  if (parsedBase.protocol !== "https:") {
    throw new Error("The hosted voice bridge requires a network-reachable HTTPS endpoint.");
  }
  assertSafeEndpoint(parsedBase);

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const endpoint = normalizedBase.endsWith("/v1")
    ? `${normalizedBase}/chat/completions`
    : `${normalizedBase}/v1/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        ...(runtime.VENUS_INFERENCE_API_KEY
          ? { Authorization: `Bearer ${runtime.VENUS_INFERENCE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...history],
        temperature: 0.78,
        max_tokens: 900,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Voice bridge returned ${response.status}.`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Voice bridge returned an empty reply.");
    return { content, model };
  } finally {
    clearTimeout(timeout);
  }
}

function assertSafeEndpoint(url: URL) {
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("The voice bridge base URL may not contain credentials, query text, or a fragment.");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "169.254.169.254" ||
    host === "metadata.google.internal" ||
    host.endsWith(".local") ||
    isPrivateIpv4(host)
  ) {
    throw new Error("The voice bridge may not target a local, private, link-local, or metadata address.");
  }
}

function isPrivateIpv4(host: string) {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((part) => part < 0 || part > 255)) return false;
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}
