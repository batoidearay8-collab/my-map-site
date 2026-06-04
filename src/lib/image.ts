import imageCompression from "browser-image-compression";

/** Maximum acceptable input file size (before compression). 50MB is plenty for floor maps. */
export const MAX_INPUT_IMAGE_BYTES = 50 * 1024 * 1024;

export class ImageTooLargeError extends Error {
  constructor(public readonly sizeBytes: number, public readonly maxBytes: number) {
    super(`Image too large: ${sizeBytes} bytes (max ${maxBytes})`);
    this.name = "ImageTooLargeError";
  }
}

export async function compressImage(file: File, maxWidthOrHeight = 1600): Promise<File> {
  // Guard against huge files that would freeze the browser
  if (file.size > MAX_INPUT_IMAGE_BYTES) {
    throw new ImageTooLargeError(file.size, MAX_INPUT_IMAGE_BYTES);
  }

  // Guard against non-image types
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }

  const opts: imageCompression.Options = {
    maxSizeMB: 1,
    maxWidthOrHeight,
    useWebWorker: true,
    // 多くのケースでメタデータ削除に寄与
    fileType: file.type || "image/jpeg"
  };

  try {
    const compressed = await imageCompression(file, opts);
    return new File([compressed], file.name, { type: compressed.type || file.type });
  } catch (err: any) {
    // If compression fails (corrupt image, unsupported codec, etc.), throw a clearer error
    throw new Error(`Image compression failed: ${err?.message || err}`);
  }
}

export function guessImagePath(fileName: string): string {
  const clean = fileName.replaceAll("\\", "/").split("/").pop() || fileName;
  return `/images/${clean}`;
}

/** Human-readable size formatter (for error messages). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
