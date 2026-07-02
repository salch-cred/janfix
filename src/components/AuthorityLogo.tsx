import { useState } from "react";

// Official Government of Karnataka state emblem — used as the default
// authority logo when a specific authority doesn't have its own logo
// configured yet, or when a configured logo URL fails to load.
export const AUTHORITY_LOGO_FALLBACK_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Seal_of_Karnataka.svg/960px-Seal_of_Karnataka.svg.png";

export function AuthorityLogo({
  url,
  className,
}: {
  url?: string | null;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const src = url && !errored ? url : AUTHORITY_LOGO_FALLBACK_URL;
  return (
    <img
      src={src}
      onError={() => setErrored(true)}
      className={className ?? "h-full w-full object-contain p-1.5"}
      alt=""
    />
  );
}
