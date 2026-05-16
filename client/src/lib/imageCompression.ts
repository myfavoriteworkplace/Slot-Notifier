/**
 * Compresses an image File using the Canvas API.
 *
 * Strategy:
 *  1. Scale down to maxDimensionPx if either dimension exceeds it.
 *  2. Encode as WebP (or original type for JPEG) starting at quality 0.85.
 *  3. Reduce quality by 0.1 each pass until the blob is ≤ maxBytes or quality
 *     drops below 0.40 (at which point the image would look noticeably degraded).
 *
 * Returns the original File unchanged when:
 *  - The file is already ≤ maxBytes.
 *  - The MIME type is not a raster image (e.g. PDF).
 *
 * Throws if the image cannot be loaded or the canvas produces no blob.
 */
export async function compressImage(
  file: File,
  maxBytes: number,
  maxDimensionPx = 1500
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= maxBytes) return file;

  return new Promise<File>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimensionPx || height > maxDimensionPx) {
        if (width >= height) {
          height = Math.round((height * maxDimensionPx) / width);
          width = maxDimensionPx;
        } else {
          width = Math.round((width * maxDimensionPx) / height);
          height = maxDimensionPx;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const outputMime =
        file.type === "image/png" ? "image/webp" : file.type;
      const outputExt =
        outputMime === "image/webp"
          ? ".webp"
          : outputMime === "image/jpeg"
          ? ".jpg"
          : ".jpg";

      const baseName = file.name.replace(/\.[^.]+$/, "");
      let quality = 0.85;

      const tryPass = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas produced no blob"));
              return;
            }
            if (blob.size <= maxBytes || quality < 0.40) {
              resolve(
                new File([blob], baseName + outputExt, {
                  type: outputMime,
                  lastModified: Date.now(),
                })
              );
            } else {
              quality = parseFloat((quality - 0.10).toFixed(2));
              tryPass();
            }
          },
          outputMime,
          quality
        );
      };

      tryPass();
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = objectUrl;
  });
}
