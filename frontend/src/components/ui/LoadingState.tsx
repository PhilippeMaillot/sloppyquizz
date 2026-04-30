type LoadingStateProps = {
  label?: string
}

export function LoadingState({ label = 'Chargement…' }: LoadingStateProps) {
  return (
    <div className="ui-loading">
      <span className="ui-loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

