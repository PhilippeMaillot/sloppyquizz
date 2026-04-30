import { useEffect, useMemo, useRef, useState } from 'react'

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

export function SlideCanvasEditor({
  elements,
  legacyImageUrl,
  legacyQuestion,
  backgroundColor,
  onChange,
  onUploadImage,
}: SlideCanvasEditorProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stageFocused, setStageFocused] = useState(false)
  const [stageScale, setStageScale] = useState(1)

  const selected = useMemo(
    () => elements.find((el) => el.id === selectedId) ?? null,
    [elements, selectedId],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onPaste = (event: ClipboardEvent) => {
      if (!stageFocused) return
      const data = event.clipboardData
      if (!data) return

      const items = Array.from(data.items ?? [])
      const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/')) ?? null
      if (!imageItem) return

      const blob = imageItem.getAsFile()
      if (!blob) return

      // If an image is present, we "consume" the paste to avoid accidental inserts elsewhere.
      event.preventDefault()

      const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/png' ? 'png' : 'webp'
      const file = new File([blob], `pasted_${crypto.randomUUID()}.${ext}`, { type: blob.type })
      void handleAddImage(file, { center: true })
    }

    container.addEventListener('paste', onPaste)
    return () => container.removeEventListener('paste', onPaste)
  }, [stageFocused, elements])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const BASE_W = 1920
    const BASE_H = 1080

    const compute = () => {
      const rect = stage.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const scale = Math.min(rect.width / BASE_W, rect.height / BASE_H)
      setStageScale(Number.isFinite(scale) && scale > 0 ? scale : 1)
    }

    compute()
    const ro = new ResizeObserver(() => compute())
    ro.observe(stage)
    return () => ro.disconnect()
  }, [])

  function updateElement(id: string, patch: Partial<SlideElement>) {
    onChange(elements.map((el) => (el.id === id ? ({ ...el, ...patch } as SlideElement) : el)))
  }

  function removeSelected() {
    if (!selectedId) return
    onChange(elements.filter((el) => el.id !== selectedId))
    setSelectedId(null)
  }

  function bringToFront() {
    if (!selectedId) return
    updateElement(selectedId, { z: nextZ(elements) })
  }

  function sendToBack() {
    if (!selectedId) return
    updateElement(selectedId, { z: -1 })
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
      setSelectedId(id)
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
    }
    onChange([...elements, el])
    setSelectedId(id)
  }

  function startDrag(id: string, startClientX: number, startClientY: number) {
    const el = elements.find((e) => e.id === id)
    const container = containerRef.current
    if (!el || !container) return

    const rect = container.getBoundingClientRect()
    const startX = el.x
    const startY = el.y

    const onMove = (e: PointerEvent) => {
      const dxPct = ((e.clientX - startClientX) / rect.width) * 100
      const dyPct = ((e.clientY - startClientY) / rect.height) * 100
      const nextX = clamp(startX + dxPct, 0, 100 - el.w)
      const nextY = clamp(startY + dyPct, 0, 100 - el.h)
      updateElement(id, { x: nextX, y: nextY })
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
    const container = containerRef.current
    if (!el || !container) return
    const rect = container.getBoundingClientRect()
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
        {selectedId ? (
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
        className="slide-canvas-stage slide-canvas-stage-editor"
        ref={stageRef}
        tabIndex={0}
        role="application"
        aria-label="Canvas (coller une image avec Ctrl/Cmd+V)"
        onFocus={() => setStageFocused(true)}
        onBlur={() => setStageFocused(false)}
        onPointerDown={() => {
          // Make sure the stage receives paste events.
          stageRef.current?.focus?.()
        }}
        style={{ background: backgroundColor ?? undefined }}
      >
        <div
          className="slide-canvas-fixed-viewport"
          ref={containerRef}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 1920,
            height: 1080,
            transform: `translate(-50%, -50%) scale(${stageScale})`,
            transformOrigin: 'center',
          }}
        >
          <SlideCanvas elements={elements} legacyImageUrl={legacyImageUrl} legacyQuestion={legacyQuestion} />

          {elements.map((el) => (
            <div
              className={`slide-canvas-hitbox${selectedId === el.id ? ' slide-canvas-hitbox-selected' : ''}`}
              key={`hit_${el.id}`}
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.w}%`,
                height: `${el.h}%`,
                zIndex: (el.z ?? 0) + 50,
              }}
              onPointerDown={(e) => {
                setSelectedId(el.id)
                ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
                startDrag(el.id, e.clientX, e.clientY)
              }}
            >
              {selectedId === el.id ? (
                <div
                  className="slide-canvas-resize"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    startResize(el.id, e.clientX, e.clientY)
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
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
        </div>
      ) : null}
    </div>
  )
}

