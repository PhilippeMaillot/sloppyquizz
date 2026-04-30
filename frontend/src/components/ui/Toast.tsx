import { useEffect } from 'react'

type ToastTone = 'success' | 'error' | 'info'

type ToastProps = {
  open: boolean
  message: string
  tone?: ToastTone
  durationMs?: number
  onClose: () => void
}

export function Toast({
  open,
  message,
  tone = 'info',
  durationMs = 2500,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => onClose(), durationMs)
    return () => window.clearTimeout(timer)
  }, [durationMs, onClose, open])

  if (!open) return null

  return (
    <div className={`ui-toast ui-toast-${tone}`} role="status" aria-live="polite">
      <span className="ui-toast-message">{message}</span>
      <button className="ui-toast-close" type="button" onClick={onClose} aria-label="Fermer">
        ✕
      </button>
    </div>
  )
}

