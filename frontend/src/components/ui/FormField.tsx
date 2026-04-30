import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

type FieldProps = {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
}

export function FormField({ label, hint, error, children }: FieldProps) {
  return (
    <label className="ui-field">
      <span className="ui-field-label">{label}</span>
      {children}
      {hint ? <small className="ui-field-hint">{hint}</small> : null}
      {error ? <small className="ui-field-error">{error}</small> : null}
    </label>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement>
export function Input(props: InputProps) {
  return <input className={`ui-input${props.className ? ` ${props.className}` : ''}`} {...props} />
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>
export function Textarea(props: TextareaProps) {
  return (
    <textarea className={`ui-input${props.className ? ` ${props.className}` : ''}`} {...props} />
  )
}

