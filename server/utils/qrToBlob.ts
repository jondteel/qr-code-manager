export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  if (!canvas || typeof canvas.toBlob !== "function") throw new Error("PNG export is unavailable.");
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob || blob.type !== "image/png" || blob.size < 33) throw new Error("Failed to create PNG image.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  const view = new DataView(bytes.buffer);
  if (!signature.every((b, i) => bytes[i] === b) ||
      String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR" ||
      view.getUint32(16) !== canvas.width || view.getUint32(20) !== canvas.height) {
    throw new Error("Failed to create PNG image.");
  }
  // Decode the browser-produced image before handing it to a download/share API.
  if (typeof createImageBitmap !== "function") throw new Error("PNG image validation is unavailable.");
  const image = await createImageBitmap(blob);
  try {
    if (image.width !== canvas.width || image.height !== canvas.height) throw new Error("Invalid PNG dimensions.");
  } finally {
    image.close();
  }
  return blob;
}
