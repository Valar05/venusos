import { headers } from "next/headers";
import VenusShell from "./venus-shell";

export default async function Home() {
  const requestHeaders = await headers();
  const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? safeDecode(encodedName)
      : encodedName;

  return <VenusShell ownerName={fullName ?? "Owner"} />;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
