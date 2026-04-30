import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { PageCard } from '../components/ui/PageCard'
import { Button } from '../components/ui/Button'
import { FormField, Input } from '../components/ui/FormField'
import { authApi } from '../services/authApi'
import { useAuthStore } from '../stores/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuthStore((state) => state.setSession)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await authApi.login({ username, password })
      setSession(response.accessToken, response.user)
      const from = (location.state as { from?: { pathname?: string } } | null)?.from
        ?.pathname
      navigate(from ?? '/dashboard', { replace: true })
    } catch {
      setError('Pseudo ou mot de passe invalide.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageCard
      title="Connexion"
      description="Retrouve ton dashboard et lance des rooms en quelques clics."
      eyebrow="Bienvenue"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField label="Pseudo">
          <Input
            autoComplete="username"
            name="username"
            onChange={(event) => setUsername(event.target.value)}
            required
            type="text"
            value={username}
          />
        </FormField>

        <FormField label="Mot de passe">
          <Input
            autoComplete="current-password"
            minLength={8}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </FormField>

        {error ? <p className="form-error">{error}</p> : null}

        <Button disabled={isSubmitting} size="lg" type="submit" variant="primary">
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>

      <Link to="/register" className="text-link">
        Créer un compte
      </Link>
    </PageCard>
  )
}
