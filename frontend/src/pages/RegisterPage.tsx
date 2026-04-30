import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageCard } from '../components/ui/PageCard'
import { Button } from '../components/ui/Button'
import { FormField, Input } from '../components/ui/FormField'
import { authApi } from '../services/authApi'
import { useAuthStore } from '../stores/authStore'

export function RegisterPage() {
  const navigate = useNavigate()
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
      const response = await authApi.register({ username, password })
      setSession(response.accessToken, response.user)
      navigate('/dashboard', { replace: true })
    } catch {
      setError('Impossible de créer ce compte. Ce pseudo est peut-être déjà pris.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageCard
      title="Créer un compte"
      description="Sauvegarde tes quiz, lance des rooms et retrouve tes scores."
      eyebrow="On y va"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField label="Pseudo">
          <Input
            autoComplete="username"
            minLength={2}
            name="username"
            onChange={(event) => setUsername(event.target.value)}
            required
            type="text"
            value={username}
          />
        </FormField>

        <FormField label="Mot de passe" hint="Minimum 8 caractères.">
          <Input
            autoComplete="new-password"
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
          {isSubmitting ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>

      <Link to="/login" className="text-link">
        Déjà un compte ?
      </Link>
    </PageCard>
  )
}
