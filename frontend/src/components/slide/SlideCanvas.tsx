import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

import type { SlideElement, SlideVideoElement } from '../../types/quiz'
import { getBackendOrigin } from '../../services/audioApi'

type SlideCanvasProps = {
  title?: string | null
  elements?: SlideElement[] | null
  legacyImageUrl?: string | null
  legacyQuestion?: string | null
  autoPlayVideos?: boolean
  showVideoControls?: boolean
  hiddenElementIds?: string[]
  onHostHideElement?: (elementId: string) => void
}

const CANVAS_BASE_WIDTH = 1920
const DEFAULT_TEXT_SIZE = 22
const DEFAULT_TEXT_COLOR = '#1d2340'
const DEFAULT_SHAPE_COLOR = '#1d2340'

function resolveMediaUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${getBackendOrigin()}${url}`
}

function toCanvasFontSize(fontSize: number | undefined) {
  const safeFontSize =
    typeof fontSize === 'number' && Number.isFinite(fontSize) && fontSize > 0
      ? fontSize
      : DEFAULT_TEXT_SIZE
  return `${(safeFontSize / CANVAS_BASE_WIDTH) * 100}cqw`
}

function safeTime(value: number | null | undefined, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

function videoClipUrl(videoUrl: string, startTime: number, endTime: number) {
  const resolved = resolveMediaUrl(videoUrl)
  if (endTime > startTime) {
    return `${resolved}#t=${startTime},${endTime}`
  }
  return resolved
}

function CanvasVideo({
  element,
  autoPlay,
  showControls,
}: {
  element: SlideVideoElement
  autoPlay: boolean
  showControls: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const startTime = safeTime(element.startTime)
  const endTime = safeTime(element.endTime, startTime)
  const src = videoClipUrl(element.videoUrl, startTime, endTime)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const seekToStart = () => {
      if (Number.isFinite(video.duration)) {
        video.currentTime = Math.min(startTime, Math.max(0, video.duration - 0.1))
      } else {
        video.currentTime = startTime
      }
    }

    if (video.readyState >= 1) {
      seekToStart()
    } else {
      video.addEventListener('loadedmetadata', seekToStart, { once: true })
      return () => video.removeEventListener('loadedmetadata', seekToStart)
    }
  }, [src, startTime])

  return (
    <video
      autoPlay={autoPlay}
      controls={showControls}
      draggable={false}
      muted={autoPlay}
      onTimeUpdate={(event) => {
        if (endTime <= startTime) return
        const video = event.currentTarget
        if (video.currentTime >= endTime) {
          video.pause()
          video.currentTime = endTime
        }
      }}
      playsInline
      preload="metadata"
      ref={videoRef}
      src={src}
    />
  )
}

export function SlideCanvas({
  elements,
  legacyImageUrl,
  legacyQuestion,
  autoPlayVideos = false,
  showVideoControls = false,
  hiddenElementIds = [],
  onHostHideElement,
}: SlideCanvasProps) {
  const finalElements: SlideElement[] = [...(elements ?? [])]
  const hiddenSet = new Set(hiddenElementIds)

  if (legacyImageUrl && !finalElements.some((el) => el.type === 'image')) {
    finalElements.push({
      id: 'legacy-image',
      type: 'image',
      x: 5,
      y: 18,
      w: 90,
      h: 70,
      z: -1,
      imageUrl: legacyImageUrl,
    })
  }

  if (legacyQuestion && !finalElements.some((el) => el.id === 'legacy-question')) {
    finalElements.push({
      id: 'legacy-question',
      type: 'text',
      x: 5,
      y: 6,
      w: 90,
      h: 10,
      z: 1,
      text: legacyQuestion,
      fontSize: 22,
      align: 'left',
      color: DEFAULT_TEXT_COLOR,
    })
  }

  const sorted = [...finalElements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))

  return (
    <div className="slide-canvas" aria-label="Slide canvas">
      {sorted.map((el) => {
        if (hiddenSet.has(el.id)) {
          return null
        }

        const style: CSSProperties = {
          left: `${el.x}%`,
          top: `${el.y}%`,
          width: `${el.w}%`,
          height: `${el.h}%`,
          zIndex: el.z,
        }

        if (el.type === 'image') {
          return (
            <div className="slide-canvas-el" key={el.id} style={style}>
              <img alt="" draggable={false} src={resolveMediaUrl(el.imageUrl)} />
            </div>
          )
        }

        if (el.type === 'video') {
          return (
            <div className="slide-canvas-el slide-canvas-video" key={el.id} style={style}>
              <CanvasVideo autoPlay={autoPlayVideos} element={el} showControls={showVideoControls} />
            </div>
          )
        }

        if (el.type === 'line') {
          const strokeWidth = Math.max(1, el.strokeWidth ?? 4)
          return (
            <div
              className="slide-canvas-el slide-canvas-line"
              key={el.id}
              style={{
                ...style,
                transform: `rotate(${el.rotation ?? 0}deg)`,
                transformOrigin: '50% 50%',
              }}
            >
              <svg aria-hidden="true" focusable="false" preserveAspectRatio="none" viewBox="0 0 100 100">
                <line
                  x1="0"
                  y1="50"
                  x2="100"
                  y2="50"
                  stroke={el.color ?? DEFAULT_SHAPE_COLOR}
                  strokeLinecap="round"
                  strokeWidth={strokeWidth}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          )
        }

        if (el.type === 'rect') {
          const isClickableMask = Boolean(el.hideOnHostClick && onHostHideElement)
          return (
            <div
              className={`slide-canvas-el slide-canvas-rect${
                isClickableMask ? ' slide-canvas-mask-clickable' : ''
              }`}
              key={el.id}
              onClick={
                isClickableMask
                  ? (event) => {
                      event.stopPropagation()
                      onHostHideElement?.(el.id)
                    }
                  : undefined
              }
              role={isClickableMask ? 'button' : undefined}
              style={{
                ...style,
                background: el.fillEnabled === false ? 'transparent' : (el.fillColor ?? DEFAULT_SHAPE_COLOR),
                borderColor: el.strokeColor ?? DEFAULT_SHAPE_COLOR,
                borderStyle: 'solid',
                borderWidth: `${Math.max(0, el.strokeWidth ?? 0)}px`,
              }}
              tabIndex={isClickableMask ? 0 : undefined}
              title={isClickableMask ? 'Cliquer pour masquer' : undefined}
            />
          )
        }

        const align = el.align ?? 'left'
        return (
          <div className="slide-canvas-el slide-canvas-text" key={el.id} style={style}>
            <div
              className={`slide-canvas-text-inner slide-canvas-text-${align}`}
              style={{
                color: el.color ?? undefined,
                fontSize: toCanvasFontSize(el.fontSize),
              }}
            >
              {el.text}
            </div>
          </div>
        )
      })}
    </div>
  )
}

