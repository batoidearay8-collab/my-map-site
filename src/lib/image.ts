import imageCompression from "browser-image-compression";

export async function compressImage(file: File, maxWidthOrHeight = 1600): Promise<File> {
  const opts: imageCompression.Options = {
    maxSizeMB: 1,
    maxWidthOrHeight,
    useWebWorker: true,
    // 多くのケースでメタデータ削除に寄与
    fileType: file.type || "image/jpeg"
  };
  const compressed = await imageCompression(file, opts);
  // browser-image-compression は通常 EXIF を引き継がない（端末差はあるので運用注意）
  return new File([compressed], file.name, { type: compressed.type || file.type });
}

export function guessImagePath(fileName: string): string {
  const clean = fileName.replaceAll("\\", "/").split("/").pop() || fileName;
  return `/images/${clean}`;
}
