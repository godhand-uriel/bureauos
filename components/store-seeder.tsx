"use client";

import { useEffect } from "react";
import { useBureauStore, useHydrated } from "@/lib/store";

/** Seeds demo cases once localStorage state has hydrated (demo mode only). */
export function StoreSeeder() {
  const hydrated = useHydrated();
  const ensureSeeded = useBureauStore((s) => s.ensureSeeded);

  useEffect(() => {
    if (hydrated) ensureSeeded();
  }, [hydrated, ensureSeeded]);

  return null;
}
