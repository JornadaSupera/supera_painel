/**
 * Attachment rules — the limits both the `chat-attachments` and the
 * `content-attachments` buckets enforce, checked here first so a bad file is
 * refused before anything is written. A chat message and its attachment row are
 * immutable once created, so catching this late leaves a message behind that
 * cannot be taken back; a content attachment can be removed, but only while the
 * version is still a draft.
 */

export const ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

/** `accept` for the file input. */
export const ATTACHMENT_ACCEPT = ATTACHMENT_TYPES.join(",");

/** The reason a file cannot be attached, in pt-BR for the screen; `null` when it can. */
export function attachmentError(file: { type: string; size: number }): string | null {
  if (!(ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
    return "O anexo aceita apenas PNG, JPEG, WebP ou PDF.";
  }

  if (file.size <= 0) return "O arquivo está vazio.";

  if (file.size > ATTACHMENT_MAX_BYTES) return "O anexo precisa ter até 20 MB.";

  return null;
}

/**
 * A storage-safe file name: no accents, no spaces, no path separators.
 *
 * The object key is `<message id>/<name>`, and the name is what the recipient
 * sees. Keeping it readable matters more than keeping it identical.
 */
export function safeAttachmentName(name: string, mimeType: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-100);

  if (cleaned) return cleaned;

  const extension = mimeType === "application/pdf" ? "pdf" : mimeType.split("/")[1] ?? "bin";
  return `arquivo.${extension}`;
}

export function isImageAttachment(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
