import type { SelectHTMLAttributes } from 'react'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select(props: SelectProps) {
  return <select className={`ui-input${props.className ? ` ${props.className}` : ''}`} {...props} />
}

