import type { CSSProperties } from 'react'

import type { SlideElement } from '../../types/quiz'
import { getBackendOrigin } from '../../services/audioApi'

type SlideCanvasProps = {
  title?: string | null
  elements?: SlideElement[] | null
  legacyImageUrl?: string | null
  legacyQuestion?: string | null
}

const CANVAS_BASE_WIDTH = 1920
const DEFAULT_TEXT_SIZE = 22
const DEFAULT_TEXT_COLOR = '#1d2340'

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

export function SlideCanvas({ elements, legacyImageUrl, legacyQuestion }: SlideCanvasProps) {
  const finalElements: SlideElement[] = [...(elements ?? [])]

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

  const sorted = finalElements.sort((a, b) => (a.z ?? 0) - (b.z ?? 0))

  return (
    <div className="slide-canvas" aria-label="Slide canvas">
      {sorted.map((el) => {
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

