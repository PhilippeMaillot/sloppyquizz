import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  leftIcon,
  rightIcon,
  className,
  children,
  ...props
}: ButtonProps) {
  const variantClass =
    variant === 'primary'
      ? 'primary-button'
      : variant === 'danger'
        ? 'danger-button'
        : variant === 'ghost'
          ? 'ui-button-ghost'
          : 'secondary-button'

  const sizeClass =
    size === 'lg' ? 'ui-button-lg' : size === 'sm' ? 'ui-button-sm' : 'ui-button-md'

  return (
    <button className={`${variantClass} ${sizeClass}${className ? ` ${className}` : ''}`} {...props}>
      {leftIcon ? <span className="ui-button-icon">{leftIcon}</span> : null}
      <span>{children}</span>
      {rightIcon ? <span className="ui-button-icon">{rightIcon}</span> : null}
    </button>
  )
}

