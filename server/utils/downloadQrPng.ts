/// <reference lib="dom" />

type DownloadOptions = {
  filename: string; // e.g. "my_qr.png"

  /**
   * If true, we'll try the Share Sheet on mobile (iOS/Android) first.
   * Desktop will NOT use share even if supported.
   */
  preferShare?: boolean; // default true

  /**
   * iOS Safari can be inconsistent with programmatic downloads.
   * If true, we'll open the image in a new tab as a fallback.
   */
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

function isAndroid(): boolean {
  if (!import.meta.client) return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * We only want to use the Share Sheet on mobile devices.
 * Desktop Chrome supports it too, but that's not the UX you want.
 */
function shouldUseShareSheet(): boolean {
  return isIOS() || isAndroid();
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

  // ✅ Mobile-first UX: Share sheet -> "Save Image"/"Save to Photos"
  const navAny = navigator as any;

  const canShareFiles =
    preferShare &&
    shouldUseShareSheet() &&
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
      // user canceled or share failed -> fallback below
    }
  }

  // ✅ Standard download (desktop + many Android browsers)
  const url = URL.createObjectURL(blob);

  try {
    // iOS Safari is inconsistent with programmatic downloads.
    // If share wasn't used/available, opening in a new tab gives the user
    // a reliable "Save Image" via long-press.
    if (isIOS() && openInNewTabFallback) {
      w.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const a = d.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";

    d.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Delay revoke slightly so new tab / download has time to start
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}