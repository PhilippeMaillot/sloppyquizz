import type { ReactNode } from 'react'

type ModalProps = {
  open: boolean
  title?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}

export function Modal({ open, title, children, footer, onClose }: ModalProps) {
  if (!open) return null
  return (
    <div className="ui-modal-backdrop" role="dialog" aria-modal="true">
      <div className="ui-modal" role="document">
        <header className="ui-modal-header">
          {title ? <h3 className="ui-modal-title">{title}</h3> : <span />}
          <button className="ui-modal-close" onClick={onClose} type="button">
            Fermer
          </button>
        </header>
        <div className="ui-modal-body">{children}</div>
        {footer ? <footer className="ui-modal-footer">{footer}</footer> : null}
      </div>
      <button className="ui-modal-underlay" onClick={onClose} type="button" aria-label="Fermer la modal" />
    </div>
  )
}

