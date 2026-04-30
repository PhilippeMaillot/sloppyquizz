import type { ReactNode } from 'react'

type PageCardProps = {
  className?: string
  title: string
  description?: string
  eyebrow?: string | null
  actions?: ReactNode
  children?: ReactNode
}

export function PageCard({
  className,
  title,
  description,
  eyebrow = 'SloppyQuizz',
  actions,
  children,
}: PageCardProps) {
  return (
    <section className={`page-card${className ? ` ${className}` : ''}`}>
      <div className="page-card-header">
        <div className="page-card-header-main">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="page-card-header-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

