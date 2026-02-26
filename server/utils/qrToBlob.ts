export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png", 1)
  );
  if (!blob) throw new Error("Failed to create PNG blob.");
  return blob;
}