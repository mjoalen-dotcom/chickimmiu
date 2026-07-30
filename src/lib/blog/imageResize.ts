export type ImageResizeHandle = 'ne' | 'nw' | 'se' | 'sw'

type ResizeImageArgs = {
  currentX: number
  currentY: number
  handle: ImageResizeHandle
  maxWidth: number
  minWidth?: number
  startHeight: number
  startWidth: number
  startX: number
  startY: number
}

export type ImageDimensions = {
  height: number
  width: number
}

export function clampImageWidth(
  width: number,
  minWidth = 24,
  maxWidth = 1200,
) {
  const safeMin = Math.max(1, Math.round(minWidth))
  const safeMax = Math.max(safeMin, Math.round(maxWidth))
  const safeWidth = Number.isFinite(width) ? Math.round(width) : safeMin
  return Math.min(safeMax, Math.max(safeMin, safeWidth))
}

export function dimensionsForWidth(
  width: number,
  aspectRatio: number,
  minWidth = 24,
  maxWidth = 1200,
): ImageDimensions {
  const safeRatio =
    Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1
  const clampedWidth = clampImageWidth(width, minWidth, maxWidth)

  return {
    width: clampedWidth,
    height: Math.max(1, Math.round(clampedWidth / safeRatio)),
  }
}

export function resizeImageFromCorner({
  currentX,
  currentY,
  handle,
  maxWidth,
  minWidth = 24,
  startHeight,
  startWidth,
  startX,
  startY,
}: ResizeImageArgs): ImageDimensions {
  const safeWidth = Math.max(1, startWidth)
  const safeHeight = Math.max(1, startHeight)
  const aspectRatio = safeWidth / safeHeight
  const horizontalDirection = handle.endsWith('e') ? 1 : -1
  const verticalDirection = handle.startsWith('s') ? 1 : -1
  const horizontalWidth =
    safeWidth + (currentX - startX) * horizontalDirection
  const verticalHeight =
    safeHeight + (currentY - startY) * verticalDirection
  const verticalWidth = verticalHeight * aspectRatio
  const horizontalChange = Math.abs(horizontalWidth - safeWidth)
  const verticalChange = Math.abs(verticalWidth - safeWidth)
  const nextWidth =
    verticalChange > horizontalChange ? verticalWidth : horizontalWidth

  return dimensionsForWidth(
    nextWidth,
    aspectRatio,
    minWidth,
    maxWidth,
  )
}
