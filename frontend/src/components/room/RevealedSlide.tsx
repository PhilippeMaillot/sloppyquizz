import type { LiveSlide } from '../../types/room'
import { SlideCanvas } from '../slide/SlideCanvas'

type RevealedSlideProps = {
  slide: LiveSlide
}

export function RevealedSlide({ slide }: RevealedSlideProps) {
  return (
    <section className="revealed-slide">
      <div
        className="slide-canvas-stage live-slide-stage"
        style={{ background: slide.backgroundColor ?? undefined }}
      >
        <SlideCanvas
          elements={slide.elements ?? null}
          legacyImageUrl={slide.imageUrl ?? null}
          legacyQuestion={slide.question ?? null}
        />
      </div>
    </section>
  )
}
