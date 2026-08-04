function forbidden(message: string) {
  return Response.json(
    { error: message },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

export function rejectCrossSiteMutation(request: Request): Response | null {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();

  if (fetchSite === "cross-site") {
    return forbidden("Cross-site writes are not allowed.");
  }

  if (origin) {
    try {
      if (new URL(origin).origin !== requestUrl.origin) {
        return forbidden("The write origin does not match this VenusOS instance.");
      }
    } catch {
      return forbidden("The write origin is invalid.");
    }
  }

  return null;
}
