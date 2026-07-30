'use client'

import { useLexicalComposerContext } from '@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@payloadcms/richtext-lexical/lexical/react/useLexicalEditable'
import {
  $isUploadNode,
  createClientFeature,
  UploadNode,
} from '@payloadcms/richtext-lexical/client'
import { $getNodeByKey, type ElementFormatType } from '@payloadcms/richtext-lexical/lexical'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Maximize2,
  Trash2,
} from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import {
  dimensionsForWidth,
  type ImageDimensions,
  type ImageResizeHandle,
  resizeImageFromCorner,
} from '@/lib/blog/imageResize'

type Alignment = 'center' | 'left' | 'right'

type OverlayState = {
  alignment: Alignment
  height: number
  left: number
  top: number
  width: number
}

type UploadAppearance = {
  alignment: Alignment
  width: number | null
}

const MIN_IMAGE_WIDTH = 24
const MAX_IMAGE_WIDTH = 1200
const UPLOAD_SELECTOR = '[data-kim-resizable-upload="true"]'

const handles: Array<{
  handle: ImageResizeHandle
  label: string
}> = [
  { handle: 'nw', label: '從左上角縮放圖片' },
  { handle: 'ne', label: '從右上角縮放圖片' },
  { handle: 'sw', label: '從左下角縮放圖片' },
  { handle: 'se', label: '從右下角縮放圖片' },
]

function numberField(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

function alignmentField(value: unknown): Alignment {
  if (value === 'left' || value === 'right') return value
  return 'center'
}

function uploadImageElement(root: HTMLElement) {
  return root.querySelector<HTMLImageElement>('img')
}

function uploadResizeElement(root: HTMLElement) {
  return (
    uploadImageElement(root) ||
    root.querySelector<HTMLElement>('.LexicalEditorTheme__upload__media') ||
    root
  )
}

function editorMaxWidth(root: HTMLElement) {
  const editorRoot = root.closest<HTMLElement>('.ContentEditable__root')
  return Math.max(
    MIN_IMAGE_WIDTH,
    Math.min(MAX_IMAGE_WIDTH, editorRoot?.clientWidth || MAX_IMAGE_WIDTH),
  )
}

function syncUploadElement(
  root: HTMLElement,
  width: number | null,
  alignment: Alignment,
) {
  root.dataset.kimResizableUpload = 'true'
  root.dataset.kimImageAlignment = alignment

  if (width) {
    root.style.setProperty('--kim-editor-image-width', `${width}px`)
  } else {
    root.style.removeProperty('--kim-editor-image-width')
  }
}

function BlogImageResizePlugin() {
  const [editor] = useLexicalComposerContext()
  const isEditable = useLexicalEditable()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<OverlayState | null>(null)
  const selectedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    selectedKeyRef.current = selectedKey
  }, [selectedKey])

  const readAppearance = useCallback(
    (nodeKey: string): UploadAppearance | null => {
      let appearance: UploadAppearance | null = null

      editor.getEditorState().read(() => {
        const node = $getNodeByKey(nodeKey)
        if (!$isUploadNode(node)) return
        const fields = node.getData().fields
        appearance = {
          alignment: alignmentField(fields?.displayAlignment),
          width: numberField(fields?.displayWidth),
        }
      })

      return appearance
    },
    [editor],
  )

  const refreshOverlay = useCallback(() => {
    const nodeKey = selectedKeyRef.current
    if (!nodeKey) {
      setOverlay(null)
      return
    }

    const root = editor.getElementByKey(nodeKey)
    const target = root ? uploadResizeElement(root) : null
    const appearance = readAppearance(nodeKey)
    if (!root || !target || !appearance) {
      setSelectedKey(null)
      setOverlay(null)
      return
    }

    const rect = target.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    setOverlay({
      alignment: appearance.alignment,
      height: Math.round(rect.height),
      left: rect.left,
      top: rect.top,
      width: Math.round(rect.width),
    })
  }, [editor, readAppearance])

  useEffect(() => {
    return editor.registerMutationListener(
      UploadNode,
      (mutations) => {
        editor.getEditorState().read(() => {
          for (const [nodeKey, mutation] of mutations) {
            if (mutation === 'destroyed') {
              if (selectedKeyRef.current === nodeKey) {
                setSelectedKey(null)
                setOverlay(null)
              }
              continue
            }

            const node = $getNodeByKey(nodeKey)
            const root = editor.getElementByKey(nodeKey)
            if (!$isUploadNode(node) || !root) continue
            const data = node.getData() as ReturnType<
              typeof node.getData
            > & { pending?: unknown }
            if (data.pending) continue
            const fields = data.fields
            root.dataset.kimUploadKey = nodeKey
            syncUploadElement(
              root,
              numberField(fields?.displayWidth),
              alignmentField(fields?.displayAlignment),
            )
          }
        })

        requestAnimationFrame(refreshOverlay)
      },
      { skipInitialization: false },
    )
  }, [editor, refreshOverlay])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const upload = target.closest<HTMLElement>(UPLOAD_SELECTOR)
      const nodeKey = upload?.dataset.kimUploadKey
      if (upload && nodeKey && editor.getRootElement()?.contains(upload)) {
        setSelectedKey(nodeKey)
        requestAnimationFrame(refreshOverlay)
      }
    }

    const unregister = editor.registerRootListener((root, previousRoot) => {
      previousRoot?.removeEventListener('click', handleClick)
      root?.addEventListener('click', handleClick)
    })

    return () => {
      editor.getRootElement()?.removeEventListener('click', handleClick)
      unregister()
    }
  }, [editor, refreshOverlay])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-kim-image-resize-ui="true"]')) return
      if (!target.closest(UPLOAD_SELECTOR)) setSelectedKey(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedKey(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useLayoutEffect(() => {
    if (!selectedKey) {
      setOverlay(null)
      return
    }

    const root = editor.getElementByKey(selectedKey)
    if (!root) return
    refreshOverlay()

    const observer = new ResizeObserver(refreshOverlay)
    observer.observe(root)
    const target = uploadResizeElement(root)
    if (target !== root) observer.observe(target)
    window.addEventListener('resize', refreshOverlay)
    window.addEventListener('scroll', refreshOverlay, true)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', refreshOverlay)
      window.removeEventListener('scroll', refreshOverlay, true)
    }
  }, [editor, refreshOverlay, selectedKey])

  const updateUpload = useCallback(
    (
      nodeKey: string,
      updates: {
        alignment?: Alignment
        dimensions?: ImageDimensions
      },
    ) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey)
        if (!$isUploadNode(node)) return
        const data = node.getData()
        const fields = data.fields || {}
        const nextAlignment =
          updates.alignment || alignmentField(fields.displayAlignment)
        node.setData({
          ...data,
          fields: {
            ...fields,
            ...(updates.dimensions
              ? {
                  displayHeight: updates.dimensions.height,
                  displayWidth: updates.dimensions.width,
                }
              : {}),
            ...(updates.alignment
              ? { displayAlignment: updates.alignment }
              : {}),
          },
        })
        node.setFormat(nextAlignment as ElementFormatType)
      })
      requestAnimationFrame(refreshOverlay)
    },
    [editor, refreshOverlay],
  )

  const removeUpload = useCallback(() => {
    if (!selectedKey) return
    editor.update(() => {
      $getNodeByKey(selectedKey)?.remove()
    })
    setSelectedKey(null)
  }, [editor, selectedKey])

  const resizeToNaturalWidth = useCallback(() => {
    if (!selectedKey) return
    const root = editor.getElementByKey(selectedKey)
    const image = root ? uploadImageElement(root) : null
    const target = root ? uploadResizeElement(root) : null
    if (!root || !target) return
    const targetRect = target.getBoundingClientRect()
    const aspectRatio =
      image && image.naturalWidth > 0 && image.naturalHeight > 0
        ? image.naturalWidth / image.naturalHeight
        : targetRect.width / Math.max(1, targetRect.height)
    const dimensions = dimensionsForWidth(
      image?.naturalWidth || targetRect.width,
      aspectRatio,
      MIN_IMAGE_WIDTH,
      editorMaxWidth(root),
    )
    syncUploadElement(
      root,
      dimensions.width,
      overlay?.alignment || 'center',
    )
    updateUpload(selectedKey, { dimensions })
  }, [editor, overlay?.alignment, selectedKey, updateUpload])

  const beginResize = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      handle: ImageResizeHandle,
    ) => {
      if (!selectedKey) return
      const root = editor.getElementByKey(selectedKey)
      const target = root ? uploadResizeElement(root) : null
      if (!root || !target) return

      event.preventDefault()
      event.stopPropagation()
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Synthetic pointer events and older browsers may not expose capture.
      }

      const pointerId = event.pointerId
      const startRect = target.getBoundingClientRect()
      const startX = event.clientX
      const startY = event.clientY
      const maxWidth = editorMaxWidth(root)
      let lastDimensions: ImageDimensions = {
        height: Math.round(startRect.height),
        width: Math.round(startRect.width),
      }

      const handleMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return
        moveEvent.preventDefault()
        lastDimensions = resizeImageFromCorner({
          currentX: moveEvent.clientX,
          currentY: moveEvent.clientY,
          handle,
          maxWidth,
          minWidth: MIN_IMAGE_WIDTH,
          startHeight: startRect.height,
          startWidth: startRect.width,
          startX,
          startY,
        })
        syncUploadElement(
          root,
          lastDimensions.width,
          overlay?.alignment || 'center',
        )
        const nextRect = target.getBoundingClientRect()
        setOverlay((current) =>
          current
            ? {
                ...current,
                height: lastDimensions.height,
                left: nextRect.left,
                top: nextRect.top,
                width: lastDimensions.width,
              }
            : current,
        )
      }

      const finishResize = (finishEvent: PointerEvent) => {
        if (finishEvent.pointerId !== pointerId) return
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', finishResize)
        window.removeEventListener('pointercancel', finishResize)
        updateUpload(selectedKey, { dimensions: lastDimensions })
      }

      window.addEventListener('pointermove', handleMove, { passive: false })
      window.addEventListener('pointerup', finishResize)
      window.addEventListener('pointercancel', finishResize)
    },
    [editor, overlay?.alignment, selectedKey, updateUpload],
  )

  const resizeWithKeyboard = useCallback(
    (
      event: ReactKeyboardEvent<HTMLButtonElement>,
      handle: ImageResizeHandle,
    ) => {
      if (!selectedKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        return
      }
      const root = editor.getElementByKey(selectedKey)
      const target = root ? uploadResizeElement(root) : null
      if (!root || !target) return
      event.preventDefault()

      const rect = target.getBoundingClientRect()
      const grows =
        (handle.endsWith('e') && event.key === 'ArrowRight') ||
        (handle.endsWith('w') && event.key === 'ArrowLeft') ||
        (handle.startsWith('s') && event.key === 'ArrowDown') ||
        (handle.startsWith('n') && event.key === 'ArrowUp')
      const dimensions = dimensionsForWidth(
        rect.width + (grows ? 8 : -8),
        rect.width / Math.max(1, rect.height),
        MIN_IMAGE_WIDTH,
        editorMaxWidth(root),
      )
      syncUploadElement(
        root,
        dimensions.width,
        overlay?.alignment || 'center',
      )
      updateUpload(selectedKey, { dimensions })
    },
    [editor, overlay?.alignment, selectedKey, updateUpload],
  )

  if (!isEditable || !selectedKey || !overlay || typeof document === 'undefined') {
    return null
  }

  const toolbarAbove = overlay.top + overlay.height + 52 > window.innerHeight

  return createPortal(
    <div
      className="kim-image-resize-ui"
      data-kim-image-resize-ui="true"
      style={{
        height: overlay.height,
        left: overlay.left,
        top: overlay.top,
        width: overlay.width,
      }}
    >
      <span className="kim-image-resize-ui__dimensions" aria-live="polite">
        {overlay.width} × {overlay.height}
      </span>

      {handles.map(({ handle, label }) => (
        <button
          key={handle}
          type="button"
          className={`kim-image-resize-ui__handle kim-image-resize-ui__handle--${handle}`}
          aria-label={label}
          title={label}
          onKeyDown={(event) => resizeWithKeyboard(event, handle)}
          onPointerDown={(event) => beginResize(event, handle)}
        />
      ))}

      <div
        className={`kim-image-resize-ui__toolbar${
          toolbarAbove ? ' kim-image-resize-ui__toolbar--above' : ''
        }`}
        role="toolbar"
        aria-label="圖片工具"
      >
        {(
          [
            ['left', AlignLeft, '圖片靠左'],
            ['center', AlignCenter, '圖片置中'],
            ['right', AlignRight, '圖片靠右'],
          ] as const
        ).map(([alignment, Icon, label]) => (
          <button
            key={alignment}
            type="button"
            aria-label={label}
            aria-pressed={overlay.alignment === alignment}
            title={label}
            onClick={() => updateUpload(selectedKey, { alignment })}
          >
            <Icon aria-hidden size={16} strokeWidth={1.8} />
          </button>
        ))}
        <span className="kim-image-resize-ui__separator" />
        <button
          type="button"
          aria-label="使用圖片原始尺寸"
          title="原始尺寸"
          onClick={resizeToNaturalWidth}
        >
          <Maximize2 aria-hidden size={16} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          aria-label="移除圖片"
          title="移除圖片"
          onClick={removeUpload}
        >
          <Trash2 aria-hidden size={16} strokeWidth={1.8} />
        </button>
      </div>
    </div>,
    document.body,
  )
}

export const BlogImageResizeFeatureClient = createClientFeature({
  plugins: [
    {
      Component: BlogImageResizePlugin,
      position: 'normal',
    },
  ],
})
