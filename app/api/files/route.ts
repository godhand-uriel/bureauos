import { NextResponse } from "next/server";

/**
 * File uploads are not offered. BureauOS has no document storage: earlier
 * versions recorded a file's name and size without the file itself, which
 * read as an upload when nothing had been stored. That is switched off rather
 * than left looking functional.
 *
 * Bringing uploads back is a storage project, not a flag: private object
 * storage, server-side type and size validation, malware scanning, signed
 * short-lived download URLs, and deletion wired into account/case deletion.
 */
export async function POST() {
  return NextResponse.json({ error: "File uploads are not available." }, { status: 410 });
}
