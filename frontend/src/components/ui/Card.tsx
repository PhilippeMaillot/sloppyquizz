import { useMemo, useState, type ReactNode } from 'react'

type CardTone = 'default' | 'soft' | 'brand'

type CardProps = {
  title?: string
  eyebrow?: string
  description?: string
  tone?: CardTone
  children?: ReactNode
  actions?: ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export function Card({
  title,
  eyebrow,
  description,
  tone = 'default',
  children,
  actions,
  collapsible = false,
  defaultCollapsed = false,
}: CardProps) {
  const hasHeader = Boolean(title || eyebrow || description || actions || collapsible)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const toggleLabel = useMemo(
    () => (collapsed ? 'Développer' : 'Réduire'),
    [collapsed],
  )

  return (
    <section className={`ui-card ui-card-${tone}`}>
      {hasHeader ? (
        <header className="ui-card-header">
          <div className="ui-card-header-text">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? <h3 className="ui-card-title">{title}</h3> : null}
            {description ? <p className="ui-card-description">{description}</p> : null}
          </div>
          <div className="ui-card-actions">
            {actions}
            {collapsible ? (
              <button
                className="ui-card-toggle"
                type="button"
                aria-expanded={!collapsed}
                aria-label={toggleLabel}
                title={toggleLabel}
                onClick={() => setCollapsed((value) => !value)}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 10l5 5 5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        </header>
      ) : null}
      {children && !collapsed ? <div className="ui-card-body">{children}</div> : null}
    </section>
  )
}

