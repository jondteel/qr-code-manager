// Four modules are the QR quiet zone. All previews and exports share it.
export function qrRenderOptions(settings = {}) {
  const width = settings.size ?? 320
  const level = settings.errorLevel ?? 'M'
  const margin = Math.max(4, settings.margin ?? 4)
  if (!Number.isInteger(width) || width < 128 || width > 1024 ||
      !Number.isInteger(margin) || margin > 10 || !['L', 'M', 'Q', 'H'].includes(level)) {
    throw new Error('Invalid QR image settings')
  }
  const dark = settings.fgColor ?? '#000000'
  const light = settings.bgColor ?? '#ffffff'
  if (![dark, light].every(color => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color))) {
    throw new Error('Invalid QR colors')
  }
  return { width, margin, errorCorrectionLevel: level, color: { dark, light } }
}

export async function renderQrCanvas(QR, canvas, target, settings) {
  if (typeof target !== 'string' || !target.length || !target.isWellFormed() || !canvas?.getContext) {
    throw new Error('QR image is unavailable')
  }
  const options = qrRenderOptions(settings)
  const symbol = QR.create(target, { errorCorrectionLevel: options.errorCorrectionLevel })
  // qrcode silently expands undersized widths. Refuse instead of misreporting size.
  if (symbol.modules.size + options.margin * 2 > options.width) {
    throw new Error('Choose a larger QR size for this content')
  }
  await QR.toCanvas(canvas, target, options)
  return canvas
}
