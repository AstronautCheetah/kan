import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * /settings → /settings/account redirect.
 *
 * In the original Next.js server mode this was handled by a rewrite in
 * next.config.js, but static export (`output: "export"`) does not support
 * rewrites.  This thin page performs a client-side redirect instead.
 */
export default function SettingsIndex() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/settings/account");
  }, [router]);

  return null;
}
