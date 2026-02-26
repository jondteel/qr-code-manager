// utils/downloadQrPng.ts
/// <reference lib="dom" />
const ua = (globalThis as any).navigator?.userAgent ?? "";

type DownloadOptions = {
  filename: string; // e.g. "my_qr.png"
  preferShare?: boolean; // default true
  openInNewTabFallback?: boolean; // default true
};

function getWindow(): (Window & typeof globalThis) | null {
  const w = (globalThis as any).window as (Window & typeof globalThis) | undefined;
  return w ?? null;
}

function getDocument(): Document | null {
  const d = (globalThis as any).document as Document | undefined;
  return d ?? null;
}

function isIOS(): boolean {
  if (!import.meta.client) return false;
  const w = getWindow();
  if (!w) return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(w as any).MSStream;
}

export async function downloadPngBlob(
  blob: Blob,
  { filename, preferShare = true, openInNewTabFallback = true }: DownloadOptions
) {
  if (!import.meta.client) return;

  const w = getWindow();
  const d = getDocument();
  if (!w || !d) return;

  const file = new File([blob], filename, { type: "image/png" });

  // Best UX on mobile: Share sheet -> "Save Image" / "Save to Photos"
  const navAny = navigator as any;
  const canShareFiles =
    preferShare &&
    typeof navAny?.share === "function" &&
    (typeof navAny?.canShare !== "function" || navAny.canShare({ files: [file] }));

  if (canShareFiles) {
    try {
      await navAny.share({
        files: [file],
        title: filename.replace(/\.png$/i, ""),
      });
      return;
    } catch {
      // user canceled or share failed -> fallback
    }
  }

  // Standard download (desktop + many Android browsers)
  const url = URL.createObjectURL(blob);
  try {
    const a = d.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";

    // iOS Safari is inconsistent with programmatic downloads
    if (isIOS() && openInNewTabFallback) {
      w.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    d.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Delay revoke slightly so new tab / download has time to start
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}