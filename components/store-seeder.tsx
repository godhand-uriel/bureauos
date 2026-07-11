"use client";

import { useEffect } from "react";
import { useBureauStore } from "@/lib/store";

/** Loads the session-scoped data from the API once on mount. */
export function StoreSeeder() {
  const bootstrap = useBureauStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return null;
}
