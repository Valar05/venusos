export type VenusOwner = {
  key: string;
  displayName: string;
};

type AuthRuntimeEnv = {
  VENUS_TRUST_AUTH_HEADERS?: string;
  VENUS_OWNER_KEY_SECRET?: string;
  VENUS_ALLOWED_OWNER_EMAILS?: string;
};

const EMAIL_HEADER = "oai-authenticated-user-email";
const NAME_HEADER = "oai-authenticated-user-full-name";
const NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";

async function runtimeAuthConfig(): Promise<AuthRuntimeEnv> {
  try {
    const runtime = await import("cloudflare:workers");
    return runtime.env as unknown as AuthRuntimeEnv;
  } catch {
    return {};
  }
}

function isPreviewHost(hostname: string) {
  return hostname === "terminal.local" || hostname === "localhost";
}

function isChatGPTSitesHost(hostname: string) {
  return hostname.endsWith(".chatgpt.site");
}

function allowedEmails(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function opaqueOwnerKey(email: string, secret?: string) {
  const encoder = new TextEncoder();
  const input = encoder.encode(email);
  let digest: ArrayBuffer;

  if (secret) {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    digest = await crypto.subtle.sign("HMAC", key, input);
  } else {
    digest = await crypto.subtle.digest("SHA-256", input);
  }

  return `owner:${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

export async function ownerFromRequest(request: Request): Promise<VenusOwner | null> {
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (isPreviewHost(hostname)) {
    return { key: "local-preview", displayName: "Owner" };
  }

  const email = request.headers.get(EMAIL_HEADER)?.trim().toLowerCase();
  if (!email) return null;

  const runtime = await runtimeAuthConfig();
  const hostedByChatGPT = isChatGPTSitesHost(hostname);
  if (!hostedByChatGPT) {
    if (runtime.VENUS_TRUST_AUTH_HEADERS !== "true") return null;
    const secret = runtime.VENUS_OWNER_KEY_SECRET?.trim();
    const allowlist = allowedEmails(runtime.VENUS_ALLOWED_OWNER_EMAILS);
    if (!secret || allowlist.size === 0 || !allowlist.has(email)) return null;
  }

  const encodedName = request.headers.get(NAME_HEADER);
  const decodedName =
    encodedName && request.headers.get(NAME_ENCODING_HEADER) === "percent-encoded-utf-8"
      ? safeDecode(encodedName)
      : encodedName;
  const secret = hostedByChatGPT ? undefined : runtime.VENUS_OWNER_KEY_SECRET?.trim();

  return {
    key: await opaqueOwnerKey(email, secret),
    displayName: decodedName?.trim() || "Owner",
  };
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function ownerRequiredResponse() {
  return Response.json(
    {
      error:
        "A trusted signed-in identity is required. Self-hosted deployments must configure a verified identity boundary, an owner-key secret, and an explicit owner allowlist.",
    },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
