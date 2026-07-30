'use client'

import { useLexicalEditable } from '@payloadcms/richtext-lexical/lexical/react/useLexicalEditable'
import type { LexicalBlockClientProps } from '@payloadcms/richtext-lexical'
import { useBlockComponentContext } from '@payloadcms/richtext-lexical/client'
import { useConfig, useField, usePayloadAPI } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Maximize2,
} from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  dimensionsForWidth,
  type ImageDimensions,
  type ImageResizeHandle,
  resizeImageFromCorner,
} from '@/lib/blog/imageResize'

type Alignment = 'center' | 'left' | 'right'

const MIN_WIDTH = 24
const MAX_WIDTH = 800
const handles: Array<{
  handle: ImageResizeHandle
  label: string
}> = [
  { handle: 'nw', label: '從左上角縮放表情圖案' },
  { handle: 'ne', label: '從右上角縮放表情圖案' },
  { handle: 'sw', label: '從左下角縮放表情圖案' },
  { handle: 'se', label: '從右下角縮放表情圖案' },
]

function mediaID(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

function alignmentValue(value: unknown): Alignment {
  if (value === 'left' || value === 'right') return value
  return 'center'
}

function EmoticonEditor() {
  const { BlockCollapsible } = useBlockComponentContext()
  const isEditable = useLexicalEditable()
  const frameRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [selected, setSelected] = useState(false)
  const [previewDimensions, setPreviewDimensions] =
    useState<ImageDimensions | null>(null)
  const [aspectRatio, setAspectRatio] = useState(1)
  const { value: imageValue } = useField<unknown>({
    path: 'image',
  })
  const { value: widthValue, setValue: setWidth } = useField<number | null>({
    path: 'displayWidth',
  })
  const { setValue: setHeight } = useField<number | null>({
    path: 'displayHeight',
  })
  const { value: alignmentRaw, setValue: setAlignment } = useField<
    Alignment | null
  >({
    path: 'displayAlignment',
  })
  const alignment = alignmentValue(alignmentRaw)
  const id = mediaID(imageValue)
  const {
    config: {
      routes: { api },
      serverURL,
    },
  } = useConfig()
  const mediaURL = id
    ? formatAdminURL({
        apiRoute: api,
        path: `/media/${id}`,
        serverURL,
      })
    : null
  const [{ data, isLoading }] = usePayloadAPI(
    mediaURL || `${api}/media?limit=0`,
    {
    initialParams: { depth: 0 },
    },
  )
  const source =
    typeof data?.url === 'string'
      ? data.url
      : typeof data?.thumbnailURL === 'string'
        ? data.thumbnailURL
        : ''
  const savedWidth = Number(widthValue)
  const width =
    previewDimensions?.width ||
    (Number.isFinite(savedWidth) && savedWidth > 0 ? savedWidth : 96)
  const height =
    previewDimensions?.height ||
    Math.max(1, Math.round(width / Math.max(aspectRatio, 0.001)))

  const naturalDimensions = useMemo(() => {
    const naturalWidth = Number(data?.width)
    const naturalHeight = Number(data?.height)
    return {
      height:
        Number.isFinite(naturalHeight) && naturalHeight > 0
          ? naturalHeight
          : null,
      width:
        Number.isFinite(naturalWidth) && naturalWidth > 0
          ? naturalWidth
          : null,
    }
  }, [data?.height, data?.width])

  useEffect(() => {
    if (naturalDimensions.width && naturalDimensions.height) {
      setAspectRatio(naturalDimensions.width / naturalDimensions.height)
    }
  }, [naturalDimensions])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const frame = frameRef.current
      if (
        frame &&
        event.target instanceof Node &&
        !frame.contains(event.target)
      ) {
        setSelected(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function maxWidth() {
    const editorRoot = frameRef.current?.closest<HTMLElement>(
      '.ContentEditable__root',
    )
    return Math.max(
      MIN_WIDTH,
      Math.min(MAX_WIDTH, editorRoot?.clientWidth || MAX_WIDTH),
    )
  }

  function commitDimensions(dimensions: ImageDimensions) {
    setPreviewDimensions(null)
    setWidth(dimensions.width)
    setHeight(dimensions.height)
  }

  function beginResize(
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: ImageResizeHandle,
  ) {
    const image = imageRef.current
    if (!image) return

    event.preventDefault()
    event.stopPropagation()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic pointer events and older browsers may not expose capture.
    }

    const pointerId = event.pointerId
    const rect = image.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    let lastDimensions = {
      height: Math.round(rect.height),
      width: Math.round(rect.width),
    }

    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      moveEvent.preventDefault()
      lastDimensions = resizeImageFromCorner({
        currentX: moveEvent.clientX,
        currentY: moveEvent.clientY,
        handle,
        maxWidth: maxWidth(),
        minWidth: MIN_WIDTH,
        startHeight: rect.height,
        startWidth: rect.width,
        startX,
        startY,
      })
      setPreviewDimensions(lastDimensions)
    }

    const finishResize = (finishEvent: PointerEvent) => {
      if (finishEvent.pointerId !== pointerId) return
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', finishResize)
      window.removeEventListener('pointercancel', finishResize)
      commitDimensions(lastDimensions)
    }

    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', finishResize)
    window.addEventListener('pointercancel', finishResize)
  }

  function resizeWithKeyboard(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    handle: ImageResizeHandle,
  ) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      return
    }
    event.preventDefault()
    const grows =
      (handle.endsWith('e') && event.key === 'ArrowRight') ||
      (handle.endsWith('w') && event.key === 'ArrowLeft') ||
      (handle.startsWith('s') && event.key === 'ArrowDown') ||
      (handle.startsWith('n') && event.key === 'ArrowUp')
    commitDimensions(
      dimensionsForWidth(
        width + (grows ? 8 : -8),
        aspectRatio,
        MIN_WIDTH,
        maxWidth(),
      ),
    )
  }

  function useNaturalSize() {
    const image = imageRef.current
    const sourceWidth = image?.naturalWidth || naturalDimensions.width || width
    const sourceHeight =
      image?.naturalHeight || naturalDimensions.height || height
    commitDimensions(
      dimensionsForWidth(
        sourceWidth,
        sourceWidth / Math.max(1, sourceHeight),
        MIN_WIDTH,
        maxWidth(),
      ),
    )
  }

  return (
    <BlockCollapsible
      disableBlockName
      Label={
        <span className="kim-emoticon-block__label">
          表情圖案
          {source ? (
            <small>
              {Math.round(width)} × {Math.round(height)}
            </small>
          ) : null}
        </span>
      }
    >
      <div className="kim-emoticon-block">
        {!id ? (
          <p className="kim-emoticon-block__empty">尚未選擇表情圖案</p>
        ) : isLoading ? (
          <div className="kim-emoticon-block__loading" aria-label="正在載入表情圖案" />
        ) : source ? (
          <div
            className="kim-emoticon-block__alignment"
            data-alignment={alignment}
          >
            <div
              ref={frameRef}
              className={`kim-emoticon-block__frame${
                selected ? ' kim-emoticon-block__frame--selected' : ''
              }`}
              style={{ width: `${width}px` }}
              onClick={() => setSelected(true)}
            >
              {/* Animated PIXNET emoticons must retain the original media URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={source}
                alt={
                  typeof data?.alt === 'string'
                    ? data.alt
                    : typeof data?.filename === 'string'
                      ? data.filename
                      : '表情圖案'
                }
                draggable={false}
                onLoad={(event) => {
                  const image = event.currentTarget
                  if (image.naturalWidth && image.naturalHeight) {
                    setAspectRatio(image.naturalWidth / image.naturalHeight)
                  }
                }}
              />

              {selected && isEditable ? (
                <>
                  <span
                    className="kim-emoticon-block__dimensions"
                    aria-live="polite"
                  >
                    {Math.round(width)} × {Math.round(height)}
                  </span>
                  {handles.map(({ handle, label }) => (
                    <button
                      key={handle}
                      type="button"
                      className={`kim-emoticon-block__handle kim-emoticon-block__handle--${handle}`}
                      aria-label={label}
                      title={label}
                      onKeyDown={(event) =>
                        resizeWithKeyboard(event, handle)
                      }
                      onPointerDown={(event) => beginResize(event, handle)}
                    />
                  ))}
                  <div
                    className="kim-emoticon-block__toolbar"
                    role="toolbar"
                    aria-label="表情圖案工具"
                  >
                    {(
                      [
                        ['left', AlignLeft, '表情圖案靠左'],
                        ['center', AlignCenter, '表情圖案置中'],
                        ['right', AlignRight, '表情圖案靠右'],
                      ] as const
                    ).map(([nextAlignment, Icon, label]) => (
                      <button
                        key={nextAlignment}
                        type="button"
                        aria-label={label}
                        aria-pressed={alignment === nextAlignment}
                        title={label}
                        onClick={(event) => {
                          event.stopPropagation()
                          setAlignment(nextAlignment)
                        }}
                      >
                        <Icon aria-hidden size={16} strokeWidth={1.8} />
                      </button>
                    ))}
                    <span className="kim-emoticon-block__separator" />
                    <button
                      type="button"
                      aria-label="使用表情圖案原始尺寸"
                      title="原始尺寸"
                      onClick={(event) => {
                        event.stopPropagation()
                        useNaturalSize()
                      }}
                    >
                      <Maximize2 aria-hidden size={16} strokeWidth={1.8} />
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="kim-emoticon-block__empty">無法載入表情圖案</p>
        )}
      </div>
    </BlockCollapsible>
  )
}

export default function EmoticonResizeBlock(
  _props: LexicalBlockClientProps,
) {
  return <EmoticonEditor />
}
