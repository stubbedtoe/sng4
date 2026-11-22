import type { Colour, ImagePixels } from '../converter/model'

export const compositeOverBackground = (
  pixels: ImagePixels,
  background: Colour,
): ImagePixels => {
  const { width, height, data } = pixels
  const composited = new Uint8Array(data.length)

  for (let index = 0; index < width * height; index++) {
    const offset = index * 4
    const alpha = data[offset + 3] ?? 255
    const inverse = 255 - alpha
    composited[offset] = Math.round(
      ((data[offset] ?? 0) * alpha + background.red * inverse) / 255,
    )
    composited[offset + 1] = Math.round(
      ((data[offset + 1] ?? 0) * alpha + background.green * inverse) / 255,
    )
    composited[offset + 2] = Math.round(
      ((data[offset + 2] ?? 0) * alpha + background.blue * inverse) / 255,
    )
    composited[offset + 3] = 255
  }

  return { width, height, data: composited }
}

export const resizePixelsNearest = (
  pixels: ImagePixels,
  width: number,
  height: number,
): ImagePixels => {
  if (pixels.width === width && pixels.height === height) {
    return pixels
  }

  const resized = new Uint8Array(width * height * 4)

  for (let y = 0; y < height; y++) {
    const sourceY = Math.min(
      pixels.height - 1,
      Math.floor((y * pixels.height) / height),
    )
    for (let x = 0; x < width; x++) {
      const sourceX = Math.min(
        pixels.width - 1,
        Math.floor((x * pixels.width) / width),
      )
      const sourceOffset = (sourceY * pixels.width + sourceX) * 4
      const targetOffset = (y * width + x) * 4
      resized[targetOffset] = pixels.data[sourceOffset] ?? 0
      resized[targetOffset + 1] = pixels.data[sourceOffset + 1] ?? 0
      resized[targetOffset + 2] = pixels.data[sourceOffset + 2] ?? 0
      resized[targetOffset + 3] = pixels.data[sourceOffset + 3] ?? 255
    }
  }

  return { width, height, data: resized }
}
