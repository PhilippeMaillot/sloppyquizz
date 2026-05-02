import type { LiveSlide } from '../../types/room'
import { getBackendOrigin } from '../../services/audioApi'
import { SlideCanvas } from '../slide/SlideCanvas'

type LiveSlideViewProps = {
  slide: LiveSlide | null
  showAudioControls?: boolean
}

export function LiveSlideView({ slide, showAudioControls = false }: LiveSlideViewProps) {
  if (!slide) {
    return (
      <div className="live-slide empty-state">
        <h3>Waiting for a slide</h3>
        <p>The host has not started a question yet.</p>
      </div>
    )
  }

  return (
    <article className="live-slide">
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

      {showAudioControls && slide.audio?.storedFileUrl ? (
        <section className="score-update-card">
          <h3>Audio</h3>
          <audio
            controls
            preload="none"
            src={`${getBackendOrigin()}${slide.audio.storedFileUrl}`}
          />
          {typeof slide.audio.duration === 'number' ? (
            <small>{slide.audio.duration}s</small>
          ) : null}
        </section>
      ) : null}
    </article>
  )
}
