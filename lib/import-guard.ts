/**
 * Per-request upload size guard for the import API routes. Import endpoints accept raw file
 * uploads (multipart): an unprompted giant upload would otherwise be buffered in memory before
 * parsing. The cap is generous for real PALMS/training/traffic-light reports while still
 * blocking the obvious abuse case.
 */
export const MAX_IMPORT_BYTES = 15 * 1024 * 1024; // 15 MB combined per request

/** Cheap pre-check from the Content-Length header (present unless the upload is chunked). */
export function contentLengthExceedsLimit(request: Request): boolean {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > MAX_IMPORT_BYTES;
}

/** True when the combined size of the given files exceeds the per-request cap (post-parse check). */
export function filesExceedLimit(files: readonly File[]): boolean {
  return files.reduce((total, file) => total + file.size, 0) > MAX_IMPORT_BYTES;
}

export function importTooLargeResponse() {
  return Response.json(
    { error: `Upload too large. The combined size must be under 15 MB.` },
    { status: 413 },
  );
}