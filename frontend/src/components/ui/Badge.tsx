import type { ReactNode } from 'react'

type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'purple'

type BadgeProps = {
  tone?: BadgeTone
  children: ReactNode
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>
}

