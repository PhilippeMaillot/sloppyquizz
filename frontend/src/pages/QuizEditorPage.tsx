import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createPortal } from 'react-dom'

import { PageCard } from '../components/ui/PageCard'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { FormField, Input, Textarea } from '../components/ui/FormField'
import { LoadingState } from '../components/ui/LoadingState'
import { Toast } from '../components/ui/Toast'
import { getBackendOrigin } from '../services/audioApi'
import { quizApi } from '../services/quizApi'
import { uploadApi } from '../services/uploadApi'
import { SlideCanvasEditor } from '../components/editor/SlideCanvasEditor'
import { SlideCanvas } from '../components/slide/SlideCanvas'
import { Modal } from '../components/ui/Modal'
import type {
  ChoiceAnswer,
  ChoiceSlide,
  QuestionSlideType,
  BlindTestSlide,
  SlideElement,
  SlideTextElement,
  QuizSlide,
  QuizSummary,
} from '../types/quiz'
import { BlindTestEditor } from '../components/editor/BlindTestEditor'

const slideTypeLabels: Record<QuestionSlideType, string> = {
  single_choice: 'Choix unique',
  text_answer: 'Réponse texte',
  blind_test: 'Blind test',
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function createDefaultAnswers(): ChoiceAnswer[] {
  return [
    { id: createId('answer'), text: 'Réponse A', isCorrect: false },
    { id: createId('answer'), text: 'Réponse B', isCorrect: false },
  ]
}

function createSlide(type: QuestionSlideType, order: number): QuizSlide {
  const base = {
    id: createId('slide'),
    type,
    title: `${slideTypeLabels[type]} ${order + 1}`,
    question: '',
    description: null,
    imageUrl: null,
    backgroundColor: null,
    elements: [],
    points: 100,
    order,
  }

  if (type === 'text_answer') {
    return {
      ...base,
      type,
      expectedAnswer: '',
      manualValidationRequired: true,
    }
  }

  if (type === 'blind_test') {
    return {
      ...base,
      type,
      audio: null,
      answerMode: 'text',
      expectedAnswer: '',
      answers: createDefaultAnswers(),
    }
  }

  return {
    ...base,
    type,
    answers: createDefaultAnswers(),
  }
}

function isChoiceSlide(slide: QuizSlide): slide is ChoiceSlide {
  return slide.type === 'single_choice'
}

function isBlindTestSlide(slide: QuizSlide): slide is BlindTestSlide {
  return slide.type === 'blind_test'
}

const LEGACY_QUESTION_ELEMENT_ID = 'legacy-question'
const DEFAULT_TEXT_COLOR = '#1d2340'

function createQuestionElement(question: string, existing?: SlideTextElement): SlideTextElement {
  return {
    id: LEGACY_QUESTION_ELEMENT_ID,
    type: 'text',
    x: existing?.x ?? 5,
    y: existing?.y ?? 6,
    w: existing?.w ?? 90,
    h: existing?.h ?? 12,
    z: existing?.z ?? 10,
    text: question,
    fontSize: existing?.fontSize ?? 28,
    align: existing?.align ?? 'left',
    color: existing?.color ?? DEFAULT_TEXT_COLOR,
  }
}

function syncQuestionElement(slide: QuizSlide, question: string): QuizSlide {
  const existingElements = (slide.elements ?? []) as SlideElement[]
  const existingQuestionElement = existingElements.find(
    (el): el is SlideTextElement =>
      el.id === LEGACY_QUESTION_ELEMENT_ID && el.type === 'text',
  )

  if (!question.trim()) {
    return {
      ...slide,
      question,
      elements: existingElements.filter((el) => el.id !== LEGACY_QUESTION_ELEMENT_ID),
    } as QuizSlide
  }

  const nextQuestionElement = createQuestionElement(question, existingQuestionElement)
  const nextElements = existingQuestionElement
    ? existingElements.map((el) =>
        el.id === LEGACY_QUESTION_ELEMENT_ID ? nextQuestionElement : el,
      )
    : [...existingElements, nextQuestionElement]

  return {
    ...slide,
    question,
    elements: nextElements,
  } as QuizSlide
}

function reorderSlides(slides: QuizSlide[]) {
  return slides.map((slide, index) => ({ ...slide, order: index }))
}

function validateSlides(title: string, slides: QuizSlide[]) {
  if (!title.trim()) {
    return 'Le titre du quiz est obligatoire.'
  }

  if (slides.length === 0) {
    return 'Ajoute au moins une slide avant de sauvegarder ce quiz.'
  }

  for (const slide of slides) {
    if (!slide.title.trim()) {
      return 'Chaque slide doit avoir un titre.'
    }

    if (!slide.question.trim()) {
      return `La slide "${slide.title}" doit avoir une question.`
    }

    if (isChoiceSlide(slide)) {
      if (slide.answers.length < 2) {
        return `La slide "${slide.title}" doit avoir au moins deux réponses.`
      }

      if (slide.answers.some((answer) => !answer.text.trim())) {
        return `Toutes les réponses de "${slide.title}" doivent avoir un texte.`
      }

    }

    if (slide.type === 'blind_test') {
      if (!slide.audio?.storedFileUrl) {
        return `La slide "${slide.title}" doit avoir un extrait audio.`
      }
      if (slide.answerMode === 'single_choice' && slide.answers.length < 2) {
        return `La slide "${slide.title}" doit avoir au moins deux réponses.`
      }
    }
  }

  return null
}

export function QuizEditorPage() {
  const { quizId } = useParams()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<QuizSummary | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [slides, setSlides] = useState<QuizSlide[]>([])
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)

  const selectedSlide =
    slides.find((slide) => slide.id === selectedSlideId) ?? slides[0] ?? null

  const coverPreviewUrl = useMemo(() => {
    if (!coverImageUrl) return null
    if (coverImageUrl.startsWith('http://') || coverImageUrl.startsWith('https://')) {
      return coverImageUrl
    }
    return `${getBackendOrigin()}${coverImageUrl}`
  }, [coverImageUrl])

  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (!quizId) {
      navigate('/dashboard', { replace: true })
      return
    }

    let isMounted = true

    quizApi
      .getQuiz(quizId)
      .then((loadedQuiz) => {
        if (isMounted) {
          setQuiz(loadedQuiz)
          setTitle(loadedQuiz.title)
          setDescription(loadedQuiz.description)
          setCoverImageUrl(loadedQuiz.coverImageUrl ?? null)
          setSlides(reorderSlides(loadedQuiz.slides))
          setSelectedSlideId(loadedQuiz.slides[0]?.id ?? null)
          setError(null)
        }
      })
      .catch(() => {
        if (isMounted) {
          setError("Impossible de charger ce quiz.")
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [navigate, quizId])

  async function handleCoverSelected(file: File | null) {
    if (!file) return
    setCoverUploadError(null)
    setIsUploadingCover(true)
    try {
      const { url } = await uploadApi.uploadCover(file)
      setCoverImageUrl(url)
      setSuccessMessage('Cover envoyée.')
    } catch {
      setCoverUploadError("Impossible d'uploader la cover.")
    } finally {
      setIsUploadingCover(false)
    }
  }

  function updateSelectedSlide(nextSlide: QuizSlide) {
    setSlides((currentSlides) =>
      currentSlides.map((slide) => (slide.id === nextSlide.id ? nextSlide : slide)),
    )
  }

  function addSlide(type: QuestionSlideType) {
    const slide = createSlide(type, slides.length)
    setSlides((currentSlides) => [...currentSlides, slide])
    setSelectedSlideId(slide.id)
    setSuccessMessage(null)
  }

  function deleteSlide(slideId: string) {
    setSlides((currentSlides) => {
      const nextSlides = reorderSlides(
        currentSlides.filter((slide) => slide.id !== slideId),
      )
      setSelectedSlideId(nextSlides[0]?.id ?? null)
      return nextSlides
    })
    setSuccessMessage(null)
  }

  function addAnswer(slide: ChoiceSlide) {
    updateSelectedSlide({
      ...slide,
      answers: [
        ...slide.answers,
        {
          id: createId('answer'),
          text: `Answer ${slide.answers.length + 1}`,
          isCorrect: false,
        },
      ],
    })
  }

  function updateAnswer(
    slide: ChoiceSlide,
    answerId: string,
    patch: Partial<ChoiceAnswer>,
  ) {
    updateSelectedSlide({
      ...slide,
      answers: slide.answers.map((answer) => {
        if (answer.id !== answerId) {
          return answer
        }

        if (slide.type === 'single_choice' && patch.isCorrect) {
          return { ...answer, ...patch, isCorrect: true }
        }

        return { ...answer, ...patch }
      }),
    })

    if (slide.type === 'single_choice' && patch.isCorrect) {
      updateSelectedSlide({
        ...slide,
        answers: slide.answers.map((answer) => ({
          ...answer,
          isCorrect: answer.id === answerId,
        })),
      })
    }
  }

  function deleteAnswer(slide: ChoiceSlide, answerId: string) {
    updateSelectedSlide({
      ...slide,
      answers: slide.answers.filter((answer) => answer.id !== answerId),
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!quizId) {
      return
    }

    const validationError = validateSlides(title, slides)
    if (validationError) {
      setError(validationError)
      setSuccessMessage(null)
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const updatedQuiz = await quizApi.updateQuiz(quizId, {
        title,
        description,
        coverImageUrl,
        slides: reorderSlides(slides),
      })
      setQuiz(updatedQuiz)
      setSlides(reorderSlides(updatedQuiz.slides))
      setSuccessMessage('Quiz sauvegardé.')
    } catch {
      setError("Impossible de sauvegarder ce quiz.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageCard
      title="Éditeur de quiz"
      description="Ajoute une cover, des images par slide, et rends le tout bien lisible."
      eyebrow="Créateur"
    >
      {isLoading ? <LoadingState label="Chargement du quiz…" /> : null}

      {!isLoading && quiz ? (
        <form className="quiz-editor" onSubmit={handleSubmit} ref={formRef}>
          <section className="quiz-settings-panel">
            <Card
              title="Paramètres du quiz"
              description="Titre, description et image de couverture."
              tone="brand"
              collapsible
              defaultCollapsed={false}
            >
              <FormField label="Titre">
                <Input
                  maxLength={120}
                  minLength={1}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  type="text"
                  value={title}
                />
              </FormField>

              <FormField label="Description">
                <Textarea
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  value={description}
                />
              </FormField>

              <FormField
                label="Cover"
                hint="PNG / JPEG / WEBP — max 5MB."
                error={coverUploadError}
              >
                <input
                  accept="image/png,image/jpeg,image/webp"
                  disabled={isUploadingCover}
                  onChange={(event) => handleCoverSelected(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </FormField>

              {coverPreviewUrl ? (
                <div className="image-preview editor-cover-preview">
                  <img alt="Cover preview" src={coverPreviewUrl} />
                  <Button onClick={() => setCoverImageUrl(null)} type="button" variant="ghost">
                    Retirer la cover
                  </Button>
                </div>
              ) : (
                <EmptyState
                  title="Pas de cover"
                  description="Ajoute une image pour rendre tes quiz plus reconnaissables."
                />
              )}
            </Card>
          </section>

          <section className="slide-workbench">
            <aside className="slide-list-panel">
              <div className="slide-add-grid">
                <Button onClick={() => addSlide('single_choice')} type="button" variant="secondary">
                  Choix unique
                </Button>
                <Button onClick={() => addSlide('text_answer')} type="button" variant="secondary">
                  Texte
                </Button>
                <Button onClick={() => addSlide('blind_test')} type="button" variant="secondary">
                  Blind test
                </Button>
              </div>

              <div className="slide-list">
                {slides.length === 0 ? (
                  <p className="empty-list-copy">Aucune slide pour le moment.</p>
                ) : null}

                {slides.map((slide, index) => (
                  <div
                    className={`slide-list-item${
                      selectedSlide?.id === slide.id ? ' slide-list-item-active' : ''
                    }`}
                    key={slide.id}
                  >
                    <button
                      className="slide-list-select"
                      onClick={() => setSelectedSlideId(slide.id)}
                      type="button"
                    >
                      <span>{index + 1}</span>
                      <strong>{slide.title || 'Slide sans titre'}</strong>
                    </button>
                    <button
                      className="slide-list-trash"
                      type="button"
                      aria-label="Supprimer la slide"
                      title="Supprimer la slide"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSlide(slide.id)
                      }}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 7h16"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M10 11v6M14 11v6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M6 7l1 14h10l1-14"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 7V4h6v3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </aside>

            <section className="slide-editor-panel">
              {selectedSlide ? (
                <SlideEditor
                  addAnswer={addAnswer}
                  deleteAnswer={deleteAnswer}
                  openPreview={() => setPreviewOpen(true)}
                  quizId={quizId ?? ''}
                  slide={selectedSlide}
                  updateAnswer={updateAnswer}
                  updateSlide={updateSelectedSlide}
                />
              ) : (
                <EmptyState
                  title="Ajoute une slide"
                  description="Commence par un QCM, une question texte, ou un blind test."
                />
              )}
            </section>
          </section>

        </form>
      ) : null}

      {typeof document !== 'undefined'
        ? createPortal(
            <>
              <Toast
                open={Boolean(successMessage)}
                message={successMessage ?? ''}
                tone="success"
                onClose={() => setSuccessMessage(null)}
              />
              <Toast
                open={Boolean(error)}
                message={error ?? ''}
                tone="error"
                onClose={() => setError(null)}
                durationMs={3500}
              />
            </>,
            document.body,
          )
        : null}

      {!isLoading && quiz
        ? createPortal(
            <button
              className={`save-fab${isSaving ? ' save-fab-loading' : ''}`}
              type="button"
              aria-label={isSaving ? 'Sauvegarde en cours' : 'Sauvegarder'}
              title={isSaving ? 'Sauvegarde…' : 'Sauvegarder'}
              disabled={isSaving}
              onClick={() => formRef.current?.requestSubmit()}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 4h11l1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 4v6h8V4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 20v-7h8v7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>,
            document.body,
          )
        : null}

      <Modal
        open={previewOpen}
        title={selectedSlide ? `Aperçu — ${selectedSlide.title}` : 'Aperçu'}
        onClose={() => setPreviewOpen(false)}
        footer={
          <div className="ui-modal-footer-row">
            <div className="ui-modal-footer-left">
              <Button onClick={() => setPreviewOpen(false)} type="button" variant="secondary">
                Fermer
              </Button>
            </div>
          </div>
        }
      >
        {selectedSlide ? (
          <div
            className="slide-canvas-stage editor-preview-stage"
            style={{ background: selectedSlide.backgroundColor ?? undefined }}
          >
            <SlideCanvas
              elements={(selectedSlide.elements as any) ?? null}
              legacyImageUrl={selectedSlide.imageUrl ?? null}
              legacyQuestion={selectedSlide.question ?? null}
            />
          </div>
        ) : (
          <EmptyState title="Aucune slide sélectionnée" description="Sélectionne une slide pour la prévisualiser." />
        )}
      </Modal>
    </PageCard>
  )
}

type SlideEditorProps = {
  quizId: string
  slide: QuizSlide
  updateSlide: (slide: QuizSlide) => void
  openPreview: () => void
  addAnswer: (slide: ChoiceSlide) => void
  updateAnswer: (
    slide: ChoiceSlide,
    answerId: string,
    patch: Partial<ChoiceAnswer>,
  ) => void
  deleteAnswer: (slide: ChoiceSlide, answerId: string) => void
}

function SlideEditor({
  quizId,
  slide,
  updateSlide,
  openPreview,
  addAnswer,
  updateAnswer,
  deleteAnswer,
}: SlideEditorProps) {
  useEffect(() => {
    const existing = (slide.elements ?? []) as any[]
    const hasLegacy = existing.some((el) => el?.id === LEGACY_QUESTION_ELEMENT_ID)
    if (!hasLegacy && slide.question?.trim()) {
      updateSlide(syncQuestionElement(slide, slide.question))
    }
    // On ne veut le faire qu’à l’ouverture d’une slide (pas à chaque frappe).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id])

  async function uploadImage(file: File) {
    const { url } = await uploadApi.uploadImage(file)
    return url
  }

  return (
    <div className="slide-editor">
      <div className="slide-editor-header">
        <span>{slideTypeLabels[slide.type]}</span>
        <Button onClick={openPreview} type="button" variant="secondary">
          Prévisualiser
        </Button>
      </div>

      <label>
        Slide title
        <input
          onChange={(event) =>
            updateSlide({ ...slide, title: event.target.value } as QuizSlide)
          }
          type="text"
          value={slide.title}
        />
      </label>

      <label>
        Question
        <textarea
          onChange={(event) =>
            updateSlide(syncQuestionElement(slide, event.target.value))
          }
          rows={3}
          value={slide.question}
        />
      </label>

      <Card title="Slide canvas" description="Place tes images et textes comme sur PowerPoint." tone="soft">
        <div className="slide-settings-row" style={{ marginBottom: 10 }}>
          <label>
            Fond
            <input
              type="color"
              value={slide.backgroundColor ?? '#ffffff'}
              onChange={(event) =>
                updateSlide({ ...slide, backgroundColor: event.target.value } as QuizSlide)
              }
              style={{ width: 56, height: 38, padding: 0, borderRadius: 10 }}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={() => updateSlide({ ...slide, backgroundColor: null } as QuizSlide)}
          >
            Reset
          </Button>
        </div>
        <SlideCanvasEditor
          elements={(slide.elements ?? []) as any}
          legacyImageUrl={slide.imageUrl}
          legacyQuestion={slide.question}
          backgroundColor={slide.backgroundColor ?? null}
          onChange={(next) => {
            const legacy = (next as any[]).find(
              (el) => el?.id === LEGACY_QUESTION_ELEMENT_ID && el?.type === 'text',
            )
            updateSlide(
              {
                ...slide,
                elements: next,
                question: typeof legacy?.text === 'string' ? legacy.text : slide.question,
              } as QuizSlide,
            )
          }}
          onUploadImage={uploadImage}
        />
      </Card>

      <div className="slide-settings-row">
        <label>
          Points
          <input
            min={0}
            onChange={(event) =>
              updateSlide({
                ...slide,
                points: Number(event.target.value),
              } as QuizSlide)
            }
            type="number"
            value={slide.points}
          />
        </label>

      </div>

      {isBlindTestSlide(slide) ? (
        <BlindTestEditor
          onChange={(nextSlide) => updateSlide(nextSlide)}
          quizId={quizId}
          slide={slide}
        />
      ) : isChoiceSlide(slide) ? (
        <ChoiceSlideFields
          addAnswer={addAnswer}
          deleteAnswer={deleteAnswer}
          slide={slide}
          updateAnswer={updateAnswer}
        />
      ) : (
        <TextAnswerFields />
      )}
    </div>
  )
}

type ChoiceSlideFieldsProps = {
  slide: ChoiceSlide
  addAnswer: (slide: ChoiceSlide) => void
  updateAnswer: (
    slide: ChoiceSlide,
    answerId: string,
    patch: Partial<ChoiceAnswer>,
  ) => void
  deleteAnswer: (slide: ChoiceSlide, answerId: string) => void
}

function ChoiceSlideFields({
  slide,
  addAnswer,
  updateAnswer,
  deleteAnswer,
}: ChoiceSlideFieldsProps) {
  return (
    <div className="answer-editor">
      <div className="answer-editor-header">
        <h3>Answers</h3>
        <button
          className="secondary-button"
          onClick={() => addAnswer(slide)}
          type="button"
        >
          Add answer
        </button>
      </div>

      {slide.answers.map((answer) => (
        <div className="answer-row" key={answer.id}>
          <input
            onChange={(event) =>
              updateAnswer(slide, answer.id, { text: event.target.value })
            }
            type="text"
            value={answer.text}
          />

          <button
            className="danger-button"
            onClick={() => deleteAnswer(slide, answer.id)}
            type="button"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  )
}

function TextAnswerFields() {
  return (
    <div className="text-answer-editor">
      <p className="form-hint">
        La correction est manuelle : les joueurs écrivent leur réponse, puis le host
        attribue les points pendant le reveal.
      </p>
    </div>
  )
}
