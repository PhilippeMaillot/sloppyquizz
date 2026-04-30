import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description: string
  icon?: ReactNode
  actions?: ReactNode
}

export function EmptyState({ title, description, icon, actions }: EmptyStateProps) {
  return (
    <section className="ui-empty">
      {icon ? <div className="ui-empty-icon">{icon}</div> : null}
      <h3 className="ui-empty-title">{title}</h3>
      <p className="ui-empty-description">{description}</p>
      {actions ? <div className="ui-empty-actions">{actions}</div> : null}
    </section>
  )
}

