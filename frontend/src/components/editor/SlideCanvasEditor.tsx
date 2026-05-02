import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

import type { SlideElement, SlideTextElement } from '../../types/quiz'
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
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function nextZ(elements: SlideElement[]) {
  return (elements.reduce((m, el) => Math.max(m, el.z ?? 0), 0) ?? 0) + 1
}

const CANVAS_BASE_WIDTH = 1920
const DEFAULT_TEXT_COLOR = '#1d2340'
const PASTE_OFFSET = 3

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
  if (el.type === 'image') {
    return { ...el, ...patch }
  }
  return { ...el, ...patch }
}

export function SlideCanvasEditor({
  elements,
  legacyImageUrl,
  legacyQuestion,
  backgroundColor,
  onChange,
  onUploadImage,
}: SlideCanvasEditorProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const clipboardRef = useRef<SlideElement[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stageFocused, setStageFocused] = useState(false)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
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
      const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/')) ?? null

      if (imageItem) {
        const blob = imageItem.getAsFile()
        if (!blob) return

        // If an image is present, we "consume" the paste to avoid accidental inserts elsewhere.
        event.preventDefault()

        const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/png' ? 'png' : 'webp'
        const file = new File([blob], `pasted_${crypto.randomUUID()}.${ext}`, { type: blob.type })
        void handleAddImage(file, { center: true })
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

  function updateElement(id: string, patch: Partial<SlideElement>) {
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

  async function handleAddImage(file: File | null, opts?: { center?: boolean }) {
    if (!file) return
    setError(null)
    setIsUploading(true)
    try {
      const url = await onUploadImage(file)
      const id = `el_${crypto.randomUUID()}`
      const w = 56
      const h = 56
      const x = opts?.center ? clamp(50 - w / 2, 0, 100 - w) : 10
      const y = opts?.center ? clamp(50 - h / 2, 0, 100 - h) : 20
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

  function startDrag(ids: string[], startClientX: number, startClientY: number) {
    const dragIds = new Set(ids)
    const dragElements = elements.filter((el) => dragIds.has(el.id))
    const stage = stageRef.current
    if (!dragElements.length || !stage) return

    const rect = stage.getBoundingClientRect()
    const startPositions = new Map(dragElements.map((el) => [el.id, { x: el.x, y: el.y, w: el.w, h: el.h }]))
    const minDx = Math.max(...dragElements.map((el) => -el.x))
    const maxDx = Math.min(...dragElements.map((el) => 100 - el.w - el.x))
    const minDy = Math.max(...dragElements.map((el) => -el.y))
    const maxDy = Math.min(...dragElements.map((el) => 100 - el.h - el.y))

    const onMove = (e: PointerEvent) => {
      const dxPct = ((e.clientX - startClientX) / rect.width) * 100
      const dyPct = ((e.clientY - startClientY) / rect.height) * 100
      const nextDx = clamp(dxPct, minDx, maxDx)
      const nextDy = clamp(dyPct, minDy, maxDy)
      onChange(
        elements.map((el) => {
          const start = startPositions.get(el.id)
          return start ? ({ ...el, x: start.x + nextDx, y: start.y + nextDy } as SlideElement) : el
        }),
      )
    }

    const onUp = () => {
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

    const onMove = (e: PointerEvent) => {
      const dwPct = ((e.clientX - startClientX) / rect.width) * 100
      const dhPct = ((e.clientY - startClientY) / rect.height) * 100
      const nextW = clamp(startW + dwPct, 6, 100 - el.x)
      const nextH = clamp(startH + dhPct, 6, 100 - el.y)
      updateElement(id, { w: nextW, h: nextH })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

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
        <Button onClick={handleAddText} type="button" variant="secondary">
          + Texte
        </Button>
        <label className="secondary-button" style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}>
          + Image
          <input
            accept="image/png,image/jpeg,image/webp"
            disabled={isUploading}
            onChange={(e) => handleAddImage(e.target.files?.[0] ?? null)}
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
          selected?.type === 'text' ? ' slide-canvas-workspace-with-inspector' : ''
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
              {selectedId === el.id ? (
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
                max={72}
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
        ) : null}
      </div>
    </div>
  )
}

