import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  SyntheticEvent,
} from 'react'

import type {
  SlideElement,
  SlideLineElement,
  SlideRectElement,
  SlideTextElement,
  SlideVideoElement,
} from '../../types/quiz'
import { getBackendOrigin } from '../../services/audioApi'
import { Button } from '../ui/Button'
import { FormField, Input } from '../ui/FormField'
import { SlideCanvas } from '../slide/SlideCanvas'

type SlideCanvasEditorProps = {
  elements: SlideElement[]
  legacyImageUrl?: string | null
  legacyQuestion?: string | null
  backgroundColor?: string | null
  onChange: (next: SlideElement[]) => void
  onUploadImage: (file: File) => Promise<string>
  onUploadVideo: (file: File) => Promise<string>
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function nextZ(elements: SlideElement[]) {
  return (elements.reduce((m, el) => Math.max(m, el.z ?? 0), 0) ?? 0) + 1
}

const CANVAS_BASE_WIDTH = 1920
const DEFAULT_TEXT_COLOR = '#1d2340'
const DEFAULT_SHAPE_COLOR = '#1d2340'
const PASTE_OFFSET = 3
const SNAP_THRESHOLD = 0.75
const VIDEO_MIN_CLIP_SECONDS = 0.1

type CanvasBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

type MarqueeState = {
  startX: number
  startY: number
  currentX: number
  currentY: number
  additive: boolean
}

type AlignmentGuide = {
  axis: 'x' | 'y'
  position: number
}

type VideoDragTarget = 'start' | 'end'
type SlideElementPatch =
  | Partial<SlideElement>
  | Partial<SlideTextElement>
  | Partial<SlideVideoElement>
  | Partial<SlideLineElement>
  | Partial<SlideRectElement>

function toCanvasFontSize(fontSize: number | undefined) {
  const safeFontSize =
    typeof fontSize === 'number' && Number.isFinite(fontSize) && fontSize > 0
      ? fontSize
      : 22
  return `${(safeFontSize / CANVAS_BASE_WIDTH) * 100}cqw`
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable
}

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids))
}

function elementBounds(el: SlideElement): CanvasBounds {
  return {
    left: el.x,
    top: el.y,
    right: el.x + el.w,
    bottom: el.y + el.h,
  }
}

function elementsBounds(elements: SlideElement[]): CanvasBounds | null {
  if (!elements.length) return null
  return elements.reduce<CanvasBounds>(
    (bounds, el) => {
      const next = elementBounds(el)
      return {
        left: Math.min(bounds.left, next.left),
        top: Math.min(bounds.top, next.top),
        right: Math.max(bounds.right, next.right),
        bottom: Math.max(bounds.bottom, next.bottom),
      }
    },
    {
      left: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
    },
  )
}

function marqueeBounds(marquee: MarqueeState): CanvasBounds {
  return {
    left: Math.min(marquee.startX, marquee.currentX),
    top: Math.min(marquee.startY, marquee.currentY),
    right: Math.max(marquee.startX, marquee.currentX),
    bottom: Math.max(marquee.startY, marquee.currentY),
  }
}

function boundsIntersect(a: CanvasBounds, b: CanvasBounds) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top
}

function cloneElementWithPatch(el: SlideElement, patch: Pick<SlideElement, 'id' | 'x' | 'y' | 'z'>): SlideElement {
  return { ...el, ...patch } as SlideElement
}

function elementHasInspector(element: SlideElement | null) {
  return Boolean(
    element &&
      (element.type === 'text' || element.type === 'video' || element.type === 'line' || element.type === 'rect'),
  )
}

function isImageFile(file: File) {
  return ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
}

function isVideoFile(file: File) {
  return file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')
}

function pickSupportedFile(files: FileList | File[]) {
  return Array.from(files).find((file) => isImageFile(file) || isVideoFile(file)) ?? null
}

function hasSupportedDraggedFile(dataTransfer: DataTransfer) {
  if (pickSupportedFile(dataTransfer.files)) return true
  return Array.from(dataTransfer.items ?? []).some(
    (item) =>
      item.kind === 'file' &&
      ['image/png', 'image/jpeg', 'image/webp', 'video/mp4'].includes(item.type),
  )
}

function resolveEditorMediaUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${getBackendOrigin()}${url}`
}

function toTenthSecond(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.round(value * 10) / 10)
}

function formatClipTime(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '--:--'
  }

  const positiveValue = Math.max(0, value)
  const wholeSeconds = Math.floor(positiveValue)
  const minutes = Math.floor(wholeSeconds / 60)
  const seconds = wholeSeconds % 60
  const tenths = Math.round((positiveValue - wholeSeconds) * 10)

  if (tenths > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function normalizeAngle(value: number) {
  if (!Number.isFinite(value)) return 0
  return ((Math.round(value * 10) / 10) % 360 + 360) % 360
}

type ToolIconName = 'text' | 'line' | 'rect' | 'frame' | 'mask' | 'image' | 'video'

function ToolIcon({ name }: { name: ToolIconName }) {
  if (name === 'text') {
    return (
      <svg aria-hidden="true" className="slide-canvas-tool-icon" focusable="false" viewBox="0 0 24 24">
        <text
          className="slide-canvas-tool-text"
          dominantBaseline="middle"
          textAnchor="middle"
          x="12"
          y="13"
        >
          T
        </text>
      </svg>
    )
  }

  if (name === 'line') {
    return (
      <svg aria-hidden="true" className="slide-canvas-tool-icon" focusable="false" viewBox="0 0 24 24">
        <path d="M4 18 20 6" />
      </svg>
    )
  }

  if (name === 'rect') {
    return (
      <svg aria-hidden="true" className="slide-canvas-tool-icon" focusable="false" viewBox="0 0 24 24">
        <rect className="slide-canvas-tool-fill" height="12" rx="1" width="16" x="4" y="6" />
      </svg>
    )
  }

  if (name === 'frame') {
    return (
      <svg aria-hidden="true" className="slide-canvas-tool-icon" focusable="false" viewBox="0 0 24 24">
        <rect fill="none" height="12" rx="1" width="16" x="4" y="6" />
      </svg>
    )
  }

  if (name === 'mask') {
    return (
      <svg aria-hidden="true" className="slide-canvas-tool-icon" focusable="false" viewBox="0 0 24 24">
        <rect className="slide-canvas-tool-fill" height="12" rx="1" width="16" x="4" y="6" />
        <path d="m8 15 8-6M8 9l8 6" />
      </svg>
    )
  }

  if (name === 'image') {
    return (
      <svg aria-hidden="true" className="slide-canvas-tool-icon" focusable="false" viewBox="0 0 24 24">
        <rect fill="none" height="14" rx="1.5" width="16" x="4" y="5" />
        <path d="m7 16 4-4 3 3 2-2 2 3" />
        <circle cx="9" cy="9" r="1.2" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" className="slide-canvas-tool-icon" focusable="false" viewBox="0 0 24 24">
      <rect fill="none" height="12" rx="1.5" width="16" x="4" y="6" />
      <path d="m10 10 5 2-5 2Z" />
    </svg>
  )
}

export function SlideCanvasEditor({
  elements,
  legacyImageUrl,
  legacyQuestion,
  backgroundColor,
  onChange,
  onUploadImage,
  onUploadVideo,
}: SlideCanvasEditorProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const clipboardRef = useRef<SlideElement[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stageFocused, setStageFocused] = useState(false)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [guides, setGuides] = useState<AlignmentGuide[]>([])
  const inlineTextRef = useRef<HTMLTextAreaElement | null>(null)

  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selected = useMemo(
    () => (selectedId ? elements.find((el) => el.id === selectedId) ?? null : null),
    [elements, selectedId],
  )

  useEffect(() => {
    const elementIds = new Set(elements.map((el) => el.id))
    setSelectedIds((current) => {
      const next = current.filter((id) => elementIds.has(id))
      return sameIds(current, next) ? current : next
    })
  }, [elements])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const onPaste = (event: ClipboardEvent) => {
      if (!stageFocused) return
      if (isEditableTarget(event.target)) return
      const data = event.clipboardData
      if (!data) return

      const items = Array.from(data.items ?? [])
      const mediaItem =
        items.find((item) => item.kind === 'file' && item.type.startsWith('image/')) ??
        items.find((item) => item.kind === 'file' && item.type === 'video/mp4') ??
        null

      if (mediaItem) {
        const blob = mediaItem.getAsFile()
        if (!blob) return

        // If a media file is present, we consume the paste to avoid accidental inserts elsewhere.
        event.preventDefault()

        const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/png' ? 'png' : blob.type === 'video/mp4' ? 'mp4' : 'webp'
        const file = new File([blob], `pasted_${crypto.randomUUID()}.${ext}`, { type: blob.type })
        if (isVideoFile(file)) {
          void handleAddVideo(file, { center: true })
        } else {
          void handleAddImage(file, { center: true })
        }
        return
      }

      if (pasteSelectedElements()) {
        event.preventDefault()
      }
    }

    stage.addEventListener('paste', onPaste)
    return () => stage.removeEventListener('paste', onPaste)
  }, [stageFocused, elements])

  useEffect(() => {
    if (!editingTextId) return
    const textArea = inlineTextRef.current
    if (!textArea) return
    textArea.focus()
    textArea.select()
  }, [editingTextId])

  useEffect(() => {
    if (editingTextId && !elements.some((el) => el.id === editingTextId)) {
      setEditingTextId(null)
    }
  }, [editingTextId, elements])

  function updateElement(id: string, patch: SlideElementPatch) {
    onChange(elements.map((el) => (el.id === id ? ({ ...el, ...patch } as SlideElement) : el)))
  }

  function copySelectedElements() {
    const selectedElements = elements
      .filter((el) => selectedSet.has(el.id))
      .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
    if (!selectedElements.length) return false
    clipboardRef.current = selectedElements.map((el) => ({ ...el }))
    return true
  }

  function pasteSelectedElements() {
    const copiedElements = clipboardRef.current
    if (!copiedElements.length) return false

    const copiedBounds = elementsBounds(copiedElements)
    const shiftX =
      copiedBounds && copiedBounds.right + PASTE_OFFSET <= 100 ? PASTE_OFFSET : -(copiedBounds?.left ?? 0)
    const shiftY =
      copiedBounds && copiedBounds.bottom + PASTE_OFFSET <= 100 ? PASTE_OFFSET : -(copiedBounds?.top ?? 0)
    const firstZ = nextZ(elements)
    const pasted = copiedElements.map((el, index) =>
      cloneElementWithPatch(el, {
        id: `el_${crypto.randomUUID()}`,
        x: clamp(el.x + shiftX, 0, 100 - el.w),
        y: clamp(el.y + shiftY, 0, 100 - el.h),
        z: firstZ + index,
      }),
    )

    onChange([...elements, ...pasted])
    clipboardRef.current = pasted.map((el) => ({ ...el }))
    setSelectedIds(pasted.map((el) => el.id))
    setEditingTextId(null)
    return true
  }

  function removeSelected() {
    if (!selectedIds.length) return
    const ids = new Set(selectedIds)
    onChange(elements.filter((el) => !ids.has(el.id)))
    setSelectedIds([])
    setEditingTextId(null)
  }

  function bringToFront() {
    const selectedElements = elements
      .filter((el) => selectedSet.has(el.id))
      .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
    if (!selectedElements.length) return
    const firstZ = nextZ(elements)
    const zById = new Map(selectedElements.map((el, index) => [el.id, firstZ + index]))
    onChange(elements.map((el) => (zById.has(el.id) ? ({ ...el, z: zById.get(el.id) } as SlideElement) : el)))
  }

  function alignmentTargets(excludedIds: Set<string>) {
    const xTargets = [0, 50, 100]
    const yTargets = [0, 50, 100]

    for (const el of elements) {
      if (excludedIds.has(el.id)) continue
      const bounds = elementBounds(el)
      xTargets.push(bounds.left, (bounds.left + bounds.right) / 2, bounds.right)
      yTargets.push(bounds.top, (bounds.top + bounds.bottom) / 2, bounds.bottom)
    }

    return {
      x: Array.from(new Set(xTargets.map((value) => Number(value.toFixed(3))))),
      y: Array.from(new Set(yTargets.map((value) => Number(value.toFixed(3))))),
    }
  }

  function snapBounds(
    bounds: CanvasBounds,
    excludedIds: Set<string>,
    opts?: { xPoints?: Array<'left' | 'center' | 'right'>; yPoints?: Array<'top' | 'middle' | 'bottom'> },
  ) {
    const targets = alignmentTargets(excludedIds)
    const xPoints = opts?.xPoints ?? ['left', 'center', 'right']
    const yPoints = opts?.yPoints ?? ['top', 'middle', 'bottom']
    const pointsX = {
      left: bounds.left,
      center: (bounds.left + bounds.right) / 2,
      right: bounds.right,
    }
    const pointsY = {
      top: bounds.top,
      middle: (bounds.top + bounds.bottom) / 2,
      bottom: bounds.bottom,
    }

    let dx = 0
    let dy = 0
    let bestX = SNAP_THRESHOLD
    let bestY = SNAP_THRESHOLD
    let guideX: AlignmentGuide | null = null
    let guideY: AlignmentGuide | null = null

    for (const pointName of xPoints) {
      const point = pointsX[pointName]
      for (const target of targets.x) {
        const delta = target - point
        const distance = Math.abs(delta)
        if (distance <= bestX) {
          bestX = distance
          dx = delta
          guideX = { axis: 'x', position: target }
        }
      }
    }

    for (const pointName of yPoints) {
      const point = pointsY[pointName]
      for (const target of targets.y) {
        const delta = target - point
        const distance = Math.abs(delta)
        if (distance <= bestY) {
          bestY = distance
          dy = delta
          guideY = { axis: 'y', position: target }
        }
      }
    }

    return {
      dx,
      dy,
      guides: [guideX, guideY].filter((guide): guide is AlignmentGuide => Boolean(guide)),
    }
  }

  function sendToBack() {
    const selectedElements = elements
      .filter((el) => selectedSet.has(el.id))
      .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
    if (!selectedElements.length) return
    const minZ = elements.reduce((min, el) => Math.min(min, el.z ?? 0), 0)
    const firstZ = minZ - selectedElements.length
    const zById = new Map(selectedElements.map((el, index) => [el.id, firstZ + index]))
    onChange(elements.map((el) => (zById.has(el.id) ? ({ ...el, z: zById.get(el.id) } as SlideElement) : el)))
  }

  function initialElementPosition(
    w: number,
    h: number,
    opts?: { center?: boolean; point?: { x: number; y: number } | null },
  ) {
    if (opts?.point) {
      return {
        x: clamp(opts.point.x - w / 2, 0, 100 - w),
        y: clamp(opts.point.y - h / 2, 0, 100 - h),
      }
    }

    return {
      x: opts?.center ? clamp(50 - w / 2, 0, 100 - w) : 10,
      y: opts?.center ? clamp(50 - h / 2, 0, 100 - h) : 20,
    }
  }

  async function handleAddImage(
    file: File | null,
    opts?: { center?: boolean; point?: { x: number; y: number } | null },
  ) {
    if (!file) return
    setError(null)
    setIsUploading(true)
    try {
      const url = await onUploadImage(file)
      const id = `el_${crypto.randomUUID()}`
      const w = 56
      const h = 56
      const { x, y } = initialElementPosition(w, h, opts)
      onChange([
        ...elements,
        {
          id,
          type: 'image',
          x,
          y,
          w,
          h,
          z: nextZ(elements),
          imageUrl: url,
        },
      ])
      setSelectedIds([id])
    } catch {
      setError("Upload d'image impossible.")
    } finally {
      setIsUploading(false)
    }
  }

  function handleAddText() {
    const id = `el_${crypto.randomUUID()}`
    const el: SlideTextElement = {
      id,
      type: 'text',
      x: 8,
      y: 8,
      w: 84,
      h: 16,
      z: nextZ(elements),
      text: 'Nouveau texte',
      fontSize: 22,
      align: 'left',
      color: DEFAULT_TEXT_COLOR,
    }
    onChange([...elements, el])
    setSelectedIds([id])
    setEditingTextId(id)
  }

  function handleAddLine() {
    const id = `el_${crypto.randomUUID()}`
    const el: SlideLineElement = {
      id,
      type: 'line',
      x: 20,
      y: 48,
      w: 60,
      h: 1.2,
      z: nextZ(elements),
      color: DEFAULT_SHAPE_COLOR,
      strokeWidth: 5,
      rotation: 0,
    }
    onChange([...elements, el])
    setSelectedIds([id])
    setEditingTextId(null)
  }

  function handleAddRect(opts?: { fillEnabled?: boolean; hideOnHostClick?: boolean }) {
    const id = `el_${crypto.randomUUID()}`
    const fillEnabled = opts?.fillEnabled ?? true
    const el: SlideRectElement = {
      id,
      type: 'rect',
      x: 22,
      y: 24,
      w: 36,
      h: 24,
      z: nextZ(elements),
      fillColor: opts?.hideOnHostClick ? '#111827' : DEFAULT_SHAPE_COLOR,
      strokeColor: DEFAULT_SHAPE_COLOR,
      strokeWidth: fillEnabled ? 0 : 4,
      fillEnabled,
      hideOnHostClick: opts?.hideOnHostClick ?? false,
    }
    onChange([...elements, el])
    setSelectedIds([id])
    setEditingTextId(null)
  }

  function startDrag(ids: string[], startClientX: number, startClientY: number) {
    const dragIds = new Set(ids)
    const dragElements = elements.filter((el) => dragIds.has(el.id))
    const stage = stageRef.current
    if (!dragElements.length || !stage) return

    const rect = stage.getBoundingClientRect()
    const startPositions = new Map(dragElements.map((el) => [el.id, { x: el.x, y: el.y, w: el.w, h: el.h }]))
    const startBounds = elementsBounds(dragElements)
    const minDx = Math.max(...dragElements.map((el) => -el.x))
    const maxDx = Math.min(...dragElements.map((el) => 100 - el.w - el.x))
    const minDy = Math.max(...dragElements.map((el) => -el.y))
    const maxDy = Math.min(...dragElements.map((el) => 100 - el.h - el.y))

    const onMove = (e: PointerEvent) => {
      const dxPct = ((e.clientX - startClientX) / rect.width) * 100
      const dyPct = ((e.clientY - startClientY) / rect.height) * 100
      const rawDx = clamp(dxPct, minDx, maxDx)
      const rawDy = clamp(dyPct, minDy, maxDy)
      const snap = startBounds
        ? snapBounds(
            {
              left: startBounds.left + rawDx,
              top: startBounds.top + rawDy,
              right: startBounds.right + rawDx,
              bottom: startBounds.bottom + rawDy,
            },
            dragIds,
          )
        : { dx: 0, dy: 0, guides: [] }
      const nextDx = clamp(rawDx + snap.dx, minDx, maxDx)
      const nextDy = clamp(rawDy + snap.dy, minDy, maxDy)
      setGuides(snap.guides)
      onChange(
        elements.map((el) => {
          const start = startPositions.get(el.id)
          return start ? ({ ...el, x: start.x + nextDx, y: start.y + nextDy } as SlideElement) : el
        }),
      )
    }

    const onUp = () => {
      setGuides([])
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function startResize(id: string, startClientX: number, startClientY: number) {
    const el = elements.find((e) => e.id === id)
    const stage = stageRef.current
    if (!el || !stage) return
    const rect = stage.getBoundingClientRect()
    const startW = el.w
    const startH = el.h
    const minSize = el.type === 'line' ? 0.8 : 6

    const onMove = (e: PointerEvent) => {
      const dwPct = ((e.clientX - startClientX) / rect.width) * 100
      const dhPct = ((e.clientY - startClientY) / rect.height) * 100
      const rawW = clamp(startW + dwPct, minSize, 100 - el.x)
      const rawH = clamp(startH + dhPct, minSize, 100 - el.y)
      const snap = snapBounds(
        {
          left: el.x,
          top: el.y,
          right: el.x + rawW,
          bottom: el.y + rawH,
        },
        new Set([id]),
        { xPoints: ['right'], yPoints: ['bottom'] },
      )
      const nextW = clamp(rawW + snap.dx, minSize, 100 - el.x)
      const nextH = clamp(rawH + snap.dy, minSize, 100 - el.y)
      setGuides(snap.guides)
      updateElement(id, { w: nextW, h: nextH })
    }

    const onUp = () => {
      setGuides([])
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function startLineStretch(
    id: string,
    endpoint: 'start' | 'end',
    startClientX: number,
    startClientY: number,
  ) {
    const el = elements.find((e): e is SlideLineElement => e.id === id && e.type === 'line')
    const stage = stageRef.current
    if (!el || !stage) return

    const rect = stage.getBoundingClientRect()
    const angle = ((el.rotation ?? 0) * Math.PI) / 180
    const lineLengthPx = (el.w / 100) * rect.width
    const centerX = ((el.x + el.w / 2) / 100) * rect.width
    const centerY = ((el.y + el.h / 2) / 100) * rect.height
    const currentStartX = centerX - (Math.cos(angle) * lineLengthPx) / 2
    const currentStartY = centerY - (Math.sin(angle) * lineLengthPx) / 2
    const currentEndX = centerX + (Math.cos(angle) * lineLengthPx) / 2
    const currentEndY = centerY + (Math.sin(angle) * lineLengthPx) / 2
    const fixedX = endpoint === 'start' ? currentEndX : currentStartX
    const fixedY = endpoint === 'start' ? currentEndY : currentStartY
    const lineHeight = Math.max(0.8, el.h)

    const updateFromClient = (clientX: number, clientY: number) => {
      const movingX = clamp(clientX - rect.left, 0, rect.width)
      const movingY = clamp(clientY - rect.top, 0, rect.height)
      const startX = endpoint === 'start' ? movingX : fixedX
      const startY = endpoint === 'start' ? movingY : fixedY
      const endX = endpoint === 'start' ? fixedX : movingX
      const endY = endpoint === 'start' ? fixedY : movingY
      const vx = endX - startX
      const vy = endY - startY
      const nextLengthPx = Math.max(12, Math.hypot(vx, vy))
      const nextW = clamp((nextLengthPx / rect.width) * 100, 2, 140)
      const centerPctX = ((startX + endX) / 2 / rect.width) * 100
      const centerPctY = ((startY + endY) / 2 / rect.height) * 100
      const nextX = clamp(centerPctX - nextW / 2, -40, 140)
      const nextY = clamp(centerPctY - lineHeight / 2, -20, 120)
      const nextRotation = normalizeAngle((Math.atan2(vy, vx) * 180) / Math.PI)

      onChange(
        elements.map((item) =>
          item.id === id
            ? ({
                ...item,
                x: nextX,
                y: nextY,
                w: nextW,
                h: lineHeight,
                rotation: nextRotation,
              } as SlideElement)
            : item,
        ),
      )
    }

    const onMove = (e: PointerEvent) => updateFromClient(e.clientX, e.clientY)

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    updateFromClient(startClientX, startClientY)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function pointInStage(clientX: number, clientY: number) {
    const stage = stageRef.current
    if (!stage) return null
    const rect = stage.getBoundingClientRect()
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
    }
  }

  async function handleAddVideo(
    file: File | null,
    opts?: { center?: boolean; point?: { x: number; y: number } | null },
  ) {
    if (!file) return
    setError(null)
    setIsUploading(true)
    try {
      const uploadFile =
        file.type === 'video/mp4' ? file : new File([file], file.name || 'video.mp4', { type: 'video/mp4' })
      const url = await onUploadVideo(uploadFile)
      const id = `el_${crypto.randomUUID()}`
      const w = 64
      const h = 36
      const { x, y } = initialElementPosition(w, h, opts)
      onChange([
        ...elements,
        {
          id,
          type: 'video',
          x,
          y,
          w,
          h,
          z: nextZ(elements),
          videoUrl: url,
          startTime: 0,
          endTime: 0,
          duration: null,
        },
      ])
      setSelectedIds([id])
    } catch {
      setError('Upload video impossible.')
    } finally {
      setIsUploading(false)
    }
  }

  function startMarquee(startClientX: number, startClientY: number, additive: boolean) {
    const start = pointInStage(startClientX, startClientY)
    if (!start) return

    let current = start
    setMarquee({
      startX: start.x,
      startY: start.y,
      currentX: start.x,
      currentY: start.y,
      additive,
    })

    const onMove = (e: PointerEvent) => {
      const next = pointInStage(e.clientX, e.clientY)
      if (!next) return
      current = next
      setMarquee({
        startX: start.x,
        startY: start.y,
        currentX: next.x,
        currentY: next.y,
        additive,
      })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setMarquee(null)

      const didDrag = Math.abs(current.x - start.x) > 0.5 || Math.abs(current.y - start.y) > 0.5
      if (!didDrag) {
        if (!additive) {
          setSelectedIds([])
          setEditingTextId(null)
        }
        return
      }

      const marqueeSelection = marqueeBounds({
        startX: start.x,
        startY: start.y,
        currentX: current.x,
        currentY: current.y,
        additive,
      })
      const hitIds = elements
        .filter((el) => boundsIntersect(marqueeSelection, elementBounds(el)))
        .map((el) => el.id)

      setSelectedIds((currentIds) => (additive ? uniqueIds([...currentIds, ...hitIds]) : hitIds))
      setEditingTextId(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function handleStageKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (isEditableTarget(e.target)) return

    const shortcutKey = e.key.toLowerCase()
    const hasModifier = e.ctrlKey || e.metaKey

    if (hasModifier && shortcutKey === 'c') {
      if (copySelectedElements()) {
        e.preventDefault()
      }
      return
    }

    if (hasModifier && shortcutKey === 'x') {
      if (copySelectedElements()) {
        e.preventDefault()
        removeSelected()
      }
      return
    }

    if (shortcutKey === 'delete' || shortcutKey === 'backspace') {
      if (selectedIds.length) {
        e.preventDefault()
        removeSelected()
      }
      return
    }

    if (shortcutKey === 'escape') {
      setSelectedIds([])
      setEditingTextId(null)
    }
  }

  return (
    <div className="slide-canvas-editor">
      <div className="toolbar-actions">
        <Button
          aria-label="Ajouter du texte"
          className="slide-canvas-tool-button"
          onClick={handleAddText}
          title="Texte"
          type="button"
          variant="secondary"
        >
          <ToolIcon name="text" />
          <span className="slide-canvas-tool-label">Texte</span>
        </Button>
        <Button
          aria-label="Ajouter une ligne"
          className="slide-canvas-tool-button"
          onClick={handleAddLine}
          title="Ligne"
          type="button"
          variant="secondary"
        >
          <ToolIcon name="line" />
          <span className="slide-canvas-tool-label">Ligne</span>
        </Button>
        <Button
          aria-label="Ajouter un rectangle plein"
          className="slide-canvas-tool-button"
          onClick={() => handleAddRect({ fillEnabled: true })}
          title="Rectangle plein"
          type="button"
          variant="secondary"
        >
          <ToolIcon name="rect" />
          <span className="slide-canvas-tool-label">Rectangle plein</span>
        </Button>
        <Button
          aria-label="Ajouter un cadre"
          className="slide-canvas-tool-button"
          onClick={() => handleAddRect({ fillEnabled: false })}
          title="Cadre"
          type="button"
          variant="secondary"
        >
          <ToolIcon name="frame" />
          <span className="slide-canvas-tool-label">Cadre</span>
        </Button>
        <Button
          aria-label="Ajouter un masque cliquable"
          className="slide-canvas-tool-button"
          onClick={() => handleAddRect({ fillEnabled: true, hideOnHostClick: true })}
          title="Masque cliquable"
          type="button"
          variant="secondary"
        >
          <ToolIcon name="mask" />
          <span className="slide-canvas-tool-label">Masque cliquable</span>
        </Button>
        <label
          aria-label="Ajouter une image"
          className="secondary-button ui-button-md slide-canvas-tool-button"
          style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}
          title="Image"
        >
          <ToolIcon name="image" />
          <span className="slide-canvas-tool-label">Image</span>
          <input
            accept="image/png,image/jpeg,image/webp"
            disabled={isUploading}
            onChange={(e) => handleAddImage(e.target.files?.[0] ?? null)}
            type="file"
            style={{ display: 'none' }}
          />
        </label>
        <label
          aria-label="Ajouter une video"
          className="secondary-button ui-button-md slide-canvas-tool-button"
          style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}
          title="Video"
        >
          <ToolIcon name="video" />
          <span className="slide-canvas-tool-label">Video</span>
          <input
            accept="video/mp4"
            disabled={isUploading}
            onChange={(e) => handleAddVideo(e.target.files?.[0] ?? null)}
            type="file"
            style={{ display: 'none' }}
          />
        </label>
        {selectedIds.length ? (
          <>
            <Button onClick={bringToFront} type="button" variant="secondary">
              Avant
            </Button>
            <Button onClick={sendToBack} type="button" variant="secondary">
              Arrière
            </Button>
            <Button onClick={removeSelected} type="button" variant="danger">
              Supprimer
            </Button>
          </>
        ) : null}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div
        className={`slide-canvas-workspace${
          elementHasInspector(selected) ? ' slide-canvas-workspace-with-inspector' : ''
        }`}
      >
        <div
          className="slide-canvas-stage slide-canvas-stage-editor"
          ref={stageRef}
          tabIndex={0}
          role="application"
          aria-label="Canvas (coller une image avec Ctrl/Cmd+V)"
          onFocus={() => setStageFocused(true)}
          onBlur={() => setStageFocused(false)}
          onDragOver={(e) => {
            if (!hasSupportedDraggedFile(e.dataTransfer)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(e) => {
            const file = pickSupportedFile(e.dataTransfer.files)
            if (!file) return
            e.preventDefault()
            e.stopPropagation()
            stageRef.current?.focus?.()
            const point = pointInStage(e.clientX, e.clientY)
            if (isVideoFile(file)) {
              void handleAddVideo(file, { point })
            } else {
              void handleAddImage(file, { point })
            }
          }}
          onKeyDown={handleStageKeyDown}
          onPointerDown={(e) => {
            // Make sure the stage receives paste events.
            stageRef.current?.focus?.()
            if (e.button !== 0) return
            if (isEditableTarget(e.target)) return
            if (editingTextId) {
              setEditingTextId(null)
            }
            startMarquee(e.clientX, e.clientY, e.ctrlKey || e.metaKey)
          }}
          style={{ background: backgroundColor ?? undefined }}
        >
          <SlideCanvas elements={elements} legacyImageUrl={legacyImageUrl} legacyQuestion={legacyQuestion} />

          {elements.map((el) => (
            <div
              className={`slide-canvas-hitbox${selectedSet.has(el.id) ? ' slide-canvas-hitbox-selected' : ''}`}
              key={`hit_${el.id}`}
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.w}%`,
                height: `${el.h}%`,
                zIndex: (el.z ?? 0) + 50,
                transform: el.type === 'line' ? `rotate(${el.rotation ?? 0}deg)` : undefined,
                transformOrigin: el.type === 'line' ? '50% 50%' : undefined,
              }}
              onDoubleClick={(e) => {
                if (el.type !== 'text') return
                e.preventDefault()
                e.stopPropagation()
                setSelectedIds([el.id])
                setEditingTextId(el.id)
              }}
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                stageRef.current?.focus?.()
                if (editingTextId === el.id) return
                if (editingTextId) {
                  setEditingTextId(null)
                }
                if (e.ctrlKey || e.metaKey) {
                  setSelectedIds((current) =>
                    current.includes(el.id) ? current.filter((id) => id !== el.id) : [...current, el.id],
                  )
                  return
                }

                const dragSelection = selectedSet.has(el.id) ? selectedIds : [el.id]
                if (!selectedSet.has(el.id)) {
                  setSelectedIds([el.id])
                }
                ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
                startDrag(dragSelection, e.clientX, e.clientY)
              }}
            >
              {el.type === 'text' && editingTextId === el.id ? (
                <textarea
                  className="slide-canvas-inline-textarea"
                  onBlur={() => setEditingTextId(null)}
                  onChange={(e) => updateElement(el.id, { text: e.target.value })}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
                      setEditingTextId(null)
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  ref={inlineTextRef}
                  rows={1}
                  style={{
                    color: el.color ?? DEFAULT_TEXT_COLOR,
                    fontSize: toCanvasFontSize(el.fontSize),
                    textAlign: el.align ?? 'left',
                  }}
                  value={el.text}
                />
              ) : null}
              {selectedId === el.id && el.type === 'line' ? (
                <>
                  <div
                    className="slide-canvas-line-end slide-canvas-line-end-start"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      stageRef.current?.focus?.()
                      startLineStretch(el.id, 'start', e.clientX, e.clientY)
                    }}
                    title="Etirer et orienter depuis le debut"
                  />
                  <div
                    className="slide-canvas-line-end slide-canvas-line-end-end"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      stageRef.current?.focus?.()
                      startLineStretch(el.id, 'end', e.clientX, e.clientY)
                    }}
                    title="Etirer et orienter depuis la fin"
                  />
                </>
              ) : selectedId === el.id ? (
                <div
                  className="slide-canvas-resize"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    stageRef.current?.focus?.()
                    startResize(el.id, e.clientX, e.clientY)
                  }}
                />
              ) : null}
            </div>
          ))}
          {marquee ? (
            <div
              className="slide-canvas-marquee"
              style={{
                left: `${marqueeBounds(marquee).left}%`,
                top: `${marqueeBounds(marquee).top}%`,
                width: `${marqueeBounds(marquee).right - marqueeBounds(marquee).left}%`,
                height: `${marqueeBounds(marquee).bottom - marqueeBounds(marquee).top}%`,
              }}
            />
          ) : null}
          {guides.map((guide, index) => (
            <div
              className={`slide-canvas-guide slide-canvas-guide-${guide.axis}`}
              key={`${guide.axis}_${guide.position}_${index}`}
              style={
                guide.axis === 'x'
                  ? { left: `${guide.position}%` }
                  : { top: `${guide.position}%` }
              }
            />
          ))}
        </div>

        {selected?.type === 'text' ? (
          <div className="slide-canvas-inspector">
            <FormField label="Texte">
              <Input
                type="text"
                value={selected.text}
                onChange={(e) => updateElement(selected.id, { text: e.target.value })}
              />
            </FormField>
            <FormField label="Taille (px)">
              <Input
                type="number"
                min={12}
                max={240}
                value={selected.fontSize ?? 22}
                onChange={(e) => updateElement(selected.id, { fontSize: Number(e.target.value) })}
              />
            </FormField>
            <FormField label="Couleur">
              <Input
                className="slide-canvas-color-input"
                type="color"
                value={selected.color ?? DEFAULT_TEXT_COLOR}
                onChange={(e) => updateElement(selected.id, { color: e.target.value })}
              />
            </FormField>
          </div>
        ) : selected?.type === 'video' ? (
          <VideoClipInspector
            element={selected}
            key={selected.id}
            onUpdate={(patch) => updateElement(selected.id, patch)}
          />
        ) : selected?.type === 'line' || selected?.type === 'rect' ? (
          <ShapeInspector element={selected} onUpdate={(patch) => updateElement(selected.id, patch)} />
        ) : null}
      </div>
    </div>
  )
}

function ShapeInspector({
  element,
  onUpdate,
}: {
  element: SlideLineElement | SlideRectElement
  onUpdate: (patch: Partial<SlideLineElement> | Partial<SlideRectElement>) => void
}) {
  if (element.type === 'line') {
    return (
      <div className="slide-canvas-inspector">
        <FormField label="Couleur">
          <Input
            className="slide-canvas-color-input"
            onChange={(event) => onUpdate({ color: event.target.value })}
            type="color"
            value={element.color ?? DEFAULT_SHAPE_COLOR}
          />
        </FormField>
        <FormField label="Epaisseur">
          <Input
            min={1}
            max={24}
            onChange={(event) => onUpdate({ strokeWidth: Number(event.target.value) })}
            type="number"
            value={element.strokeWidth ?? 5}
          />
        </FormField>
        <FormField label="Longueur">
          <Input
            min={2}
            max={140}
            onChange={(event) => onUpdate({ w: Number(event.target.value) })}
            step={0.5}
            type="number"
            value={Math.round(element.w * 10) / 10}
          />
        </FormField>
        <FormField label="Angle">
          <Input
            min={0}
            max={359.9}
            onChange={(event) => onUpdate({ rotation: normalizeAngle(Number(event.target.value)) })}
            step={0.1}
            type="number"
            value={normalizeAngle(element.rotation ?? 0)}
          />
        </FormField>
      </div>
    )
  }

  return (
    <div className="slide-canvas-inspector">
      <FormField label="Plein">
        <input
          checked={element.fillEnabled !== false}
          onChange={(event) =>
            onUpdate({
              fillEnabled: event.target.checked,
              strokeWidth: event.target.checked ? (element.strokeWidth ?? 0) : Math.max(element.strokeWidth ?? 4, 1),
            })
          }
          type="checkbox"
        />
      </FormField>
      <FormField label="Couleur fond">
        <Input
          className="slide-canvas-color-input"
          disabled={element.fillEnabled === false}
          onChange={(event) => onUpdate({ fillColor: event.target.value })}
          type="color"
          value={element.fillColor ?? DEFAULT_SHAPE_COLOR}
        />
      </FormField>
      <FormField label="Couleur contour">
        <Input
          className="slide-canvas-color-input"
          onChange={(event) => onUpdate({ strokeColor: event.target.value })}
          type="color"
          value={element.strokeColor ?? DEFAULT_SHAPE_COLOR}
        />
      </FormField>
      <FormField label="Epaisseur contour">
        <Input
          min={0}
          max={24}
          onChange={(event) => onUpdate({ strokeWidth: Number(event.target.value) })}
          type="number"
          value={element.strokeWidth ?? 0}
        />
      </FormField>
      <FormField label="Masque cliquable host">
        <input
          checked={Boolean(element.hideOnHostClick)}
          onChange={(event) => onUpdate({ hideOnHostClick: event.target.checked })}
          type="checkbox"
        />
      </FormField>
    </div>
  )
}

function normalizeVideoEnd(nextEnd: number, nextStart: number, maxTime: number | null) {
  let normalizedEnd = Math.max(toTenthSecond(nextEnd), nextStart + VIDEO_MIN_CLIP_SECONDS)

  if (maxTime !== null) {
    normalizedEnd = Math.min(normalizedEnd, maxTime)
    if (normalizedEnd <= nextStart) {
      normalizedEnd = Math.min(nextStart + VIDEO_MIN_CLIP_SECONDS, maxTime)
    }
  }

  return toTenthSecond(normalizedEnd)
}

function VideoClipInspector({
  element,
  onUpdate,
}: {
  element: SlideVideoElement
  onUpdate: (patch: Partial<SlideVideoElement>) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const playSelectionRef = useRef(false)
  const [startTime, setStartTime] = useState(element.startTime ?? 0)
  const [endTime, setEndTime] = useState(element.endTime ?? 0)
  const [duration, setDuration] = useState<number | null>(element.duration ?? null)
  const [currentTime, setCurrentTime] = useState(element.startTime ?? 0)
  const [dragTarget, setDragTarget] = useState<VideoDragTarget | null>(null)

  const timelineDuration = Math.max(duration ?? endTime ?? 1, 1)
  const selectionStartPercent = clamp((startTime / timelineDuration) * 100, 0, 100)
  const selectionEndPercent = clamp((endTime / timelineDuration) * 100, 0, 100)
  const progressPercent = clamp((currentTime / timelineDuration) * 100, 0, 100)
  const selectedDuration = Math.max(0, toTenthSecond(endTime - startTime))

  function persistSelection(nextStart: number, nextEnd: number, nextDuration = duration) {
    setStartTime(nextStart)
    setEndTime(nextEnd)
    onUpdate({ startTime: nextStart, endTime: nextEnd, duration: nextDuration })
  }

  function seekTo(time: number) {
    const boundedTime = clamp(time, 0, timelineDuration)
    if (videoRef.current) {
      videoRef.current.currentTime = boundedTime
    }
    setCurrentTime(boundedTime)
  }

  function updateStartTime(nextStartTime: number, shouldSeek = true) {
    const maxStart = duration !== null ? Math.max(0, duration - VIDEO_MIN_CLIP_SECONDS) : Number.MAX_SAFE_INTEGER
    const nextStart = clamp(toTenthSecond(nextStartTime), 0, maxStart)
    const nextEnd = normalizeVideoEnd(endTime || nextStart + VIDEO_MIN_CLIP_SECONDS, nextStart, duration)

    persistSelection(nextStart, nextEnd)
    if (shouldSeek) {
      seekTo(nextStart)
    }
  }

  function updateEndTime(nextEndTime: number, shouldSeek = true) {
    const nextEnd = normalizeVideoEnd(nextEndTime, startTime, duration)

    persistSelection(startTime, nextEnd)
    if (shouldSeek) {
      seekTo(nextEnd)
    }
  }

  function getTimelineTime(event: ReactPointerEvent<HTMLElement>) {
    const timeline = timelineRef.current
    if (!timeline) {
      return 0
    }

    const rect = timeline.getBoundingClientRect()
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    return ratio * timelineDuration
  }

  function startTimelineDrag(target: VideoDragTarget, event: ReactPointerEvent<HTMLElement>) {
    setDragTarget(target)
    timelineRef.current?.setPointerCapture(event.pointerId)

    const pointerTime = getTimelineTime(event)
    if (target === 'start') {
      updateStartTime(pointerTime)
    } else {
      updateEndTime(pointerTime)
    }
  }

  function handleTimelinePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const pointerTime = getTimelineTime(event)
    const nearestTarget =
      Math.abs(pointerTime - startTime) <= Math.abs(pointerTime - endTime) ? 'start' : 'end'
    startTimelineDrag(nearestTarget, event)
  }

  function handleTimelinePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragTarget) {
      return
    }

    const pointerTime = getTimelineTime(event)
    if (dragTarget === 'start') {
      updateStartTime(pointerTime)
    } else {
      updateEndTime(pointerTime)
    }
  }

  function stopTimelineDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (timelineRef.current?.hasPointerCapture(event.pointerId)) {
      timelineRef.current.releasePointerCapture(event.pointerId)
    }
    setDragTarget(null)
  }

  function handleHandlePointerDown(
    target: VideoDragTarget,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.stopPropagation()
    startTimelineDrag(target, event)
  }

  function handleLoadedMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    const loadedDuration = event.currentTarget.duration
    if (!Number.isFinite(loadedDuration)) {
      return
    }

    const nextDuration = toTenthSecond(loadedDuration)
    const nextStart = clamp(toTenthSecond(startTime), 0, Math.max(0, nextDuration - VIDEO_MIN_CLIP_SECONDS))
    const nextEnd = normalizeVideoEnd(endTime || nextDuration, nextStart, nextDuration)

    setDuration(nextDuration)
    persistSelection(nextStart, nextEnd, nextDuration)
    if (videoRef.current) {
      videoRef.current.currentTime = nextStart
    }
    setCurrentTime(nextStart)
  }

  function handleTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
    const nextCurrentTime = event.currentTarget.currentTime
    setCurrentTime(nextCurrentTime)

    if (playSelectionRef.current && nextCurrentTime >= endTime) {
      event.currentTarget.pause()
      event.currentTarget.currentTime = endTime
      playSelectionRef.current = false
      setCurrentTime(endTime)
    }
  }

  async function playSelectedRange() {
    if (!videoRef.current) {
      return
    }

    playSelectionRef.current = true
    videoRef.current.currentTime = startTime
    setCurrentTime(startTime)

    try {
      await videoRef.current.play()
    } catch {
      playSelectionRef.current = false
    }
  }

  function setSelectionFromCurrent(target: VideoDragTarget) {
    if (target === 'start') {
      updateStartTime(currentTime, false)
    } else {
      updateEndTime(currentTime, false)
    }
  }

  return (
    <div className="slide-canvas-inspector slide-canvas-video-inspector">
      <div className="blind-source-meta">
        <strong>Clip video</strong>
        <span>{formatClipTime(duration)}</span>
      </div>

      <video
        className="video-clip-preview"
        controls
        onLoadedMetadata={handleLoadedMetadata}
        onPause={() => {
          playSelectionRef.current = false
        }}
        onTimeUpdate={handleTimeUpdate}
        preload="metadata"
        ref={videoRef}
        src={resolveEditorMediaUrl(element.videoUrl)}
      />

      <div className="blind-range-summary">
        <strong>
          {formatClipTime(startTime)} - {formatClipTime(endTime)}
        </strong>
        <span>{selectedDuration}s</span>
      </div>

      <div
        aria-label="Selection du clip video"
        className="blind-timeline video-clip-timeline"
        onPointerCancel={stopTimelineDrag}
        onPointerDown={handleTimelinePointerDown}
        onPointerLeave={(event) => {
          if (dragTarget) {
            stopTimelineDrag(event)
          }
        }}
        onPointerMove={handleTimelinePointerMove}
        onPointerUp={stopTimelineDrag}
        ref={timelineRef}
        role="group"
      >
        <div className="blind-timeline-track" />
        <div
          className="blind-timeline-selection"
          style={{
            left: `${selectionStartPercent}%`,
            width: `${Math.max(0, selectionEndPercent - selectionStartPercent)}%`,
          }}
        />
        <div className="blind-timeline-progress" style={{ left: `${progressPercent}%` }} />
        <button
          aria-label="Debut du clip"
          className="blind-timeline-handle blind-timeline-handle-start"
          onPointerDown={(event) => handleHandlePointerDown('start', event)}
          style={{ left: `${selectionStartPercent}%` }}
          type="button"
        />
        <button
          aria-label="Fin du clip"
          className="blind-timeline-handle blind-timeline-handle-end"
          onPointerDown={(event) => handleHandlePointerDown('end', event)}
          style={{ left: `${selectionEndPercent}%` }}
          type="button"
        />
      </div>

      <div className="video-clip-fields">
        <FormField label="Debut">
          <Input
            min={0}
            max={duration ?? undefined}
            onChange={(event) => updateStartTime(Number(event.target.value))}
            step={0.1}
            type="number"
            value={startTime}
          />
        </FormField>
        <FormField label="Fin">
          <Input
            min={0}
            max={duration ?? undefined}
            onChange={(event) => updateEndTime(Number(event.target.value))}
            step={0.1}
            type="number"
            value={endTime}
          />
        </FormField>
      </div>

      <div className="toolbar-actions blind-preview-actions">
        <Button onClick={playSelectedRange} type="button" variant="secondary">
          Lire le clip
        </Button>
        <Button onClick={() => setSelectionFromCurrent('start')} type="button" variant="secondary">
          Debut ici
        </Button>
        <Button onClick={() => setSelectionFromCurrent('end')} type="button" variant="secondary">
          Fin ici
        </Button>
      </div>
    </div>
  )
}

