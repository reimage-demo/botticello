import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { encryptBytes, decryptBytes } from "./lib/crypto";
import type { Id } from "./_generated/dataModel";
const MAX_BYTES = 8 * 1024 * 1024;
function cors(request: Request) {
  const origin = request.headers.get("Origin");
  const allowed = new Set(
    (
      process.env.ALLOWED_WEB_ORIGINS ??
      "https://www.botticelloautorepair.com,https://botticelloautorepair.com,http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:4174"
    ).split(","),
  );
  if (origin && !allowed.has(origin)) throw new Error("Origin not allowed.");
  return {
    "Access-Control-Allow-Origin": origin ?? "null",
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Request-Id, X-Submission-Key, X-Photo-Slot",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
export const preflight = httpAction(async (_ctx, req) => {
  try {
    return new Response(null, { status: 204, headers: cors(req) });
  } catch {
    return new Response(null, { status: 403 });
  }
});
export function validImage(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  if (type === "image/webp")
    return (
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}
export const upload = httpAction(async (ctx, req) => {
  let headers;
  try {
    headers = cors(req);
  } catch {
    return new Response(null, { status: 403 });
  }
  try {
    const id = req.headers.get("X-Request-Id") as Id<"requests">,
      submissionKey = req.headers.get("X-Submission-Key") ?? "",
      slot = req.headers.get("X-Photo-Slot") ?? "",
      contentType = req.headers.get("Content-Type") ?? "";
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(contentType) ||
      Number(req.headers.get("Content-Length")) > MAX_BYTES
    )
      return new Response("Unsupported photo.", { status: 400, headers });
    const reservation = await ctx.runMutation(internal.requests.reservePhoto, {
      id,
      submissionKey,
      slot,
    });
    if (reservation.existing) return Response.json({ ok: true }, { headers });
    // Enforce the limit while streaming, even if Content-Length is absent.
    const reader = req.body?.getReader();
    if (!reader) throw new Error("Missing photo.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Photo too large.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (!validImage(bytes, contentType)) throw new Error("Unsupported photo.");
    const encrypted = await encryptBytes(bytes, `photo:${id}:${slot}`);
    const storageId = await ctx.storage.store(
      new Blob([encrypted], { type: "application/octet-stream" }),
    );
    try {
      const attached = await ctx.runMutation(internal.requests.commitPhoto, {
        id,
        submissionKey,
        slot,
        storageId,
        contentType,
      });
      if (!attached) await ctx.storage.delete(storageId);
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
    return Response.json({ ok: true }, { headers });
  } catch {
    return new Response("Photo upload failed. Check the file or retry.", {
      status: 400,
      headers,
    });
  }
});
export const download = httpAction(async (ctx, req) => {
  let headers;
  try {
    headers = cors(req);
  } catch {
    return new Response(null, { status: 403 });
  }
  try {
    const url = new URL(req.url),
      id = url.searchParams.get("id") as Id<"requests">,
      slot = url.searchParams.get("slot") ?? "";
    const photo = await ctx.runQuery(internal.requests.photoAccess, {
      id,
      slot,
    });
    const file = await ctx.storage.get(photo.storageId);
    if (!file) throw new Error("Missing photo.");
    const bytes = await decryptBytes(
      new Uint8Array(await file.arrayBuffer()),
      `photo:${id}:${slot}`,
    );
    return new Response(bytes, {
      headers: {
        ...headers,
        "Content-Type": photo.contentType,
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new Response("Photo unavailable. Sign in again.", {
      status: 403,
      headers,
    });
  }
});
