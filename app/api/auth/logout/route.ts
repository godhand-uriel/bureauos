import { NextResponse } from "next/server";
import { clearSessionCookie, destroySession } from "@/lib/server/auth";

export async function POST() {
  await destroySession();
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
