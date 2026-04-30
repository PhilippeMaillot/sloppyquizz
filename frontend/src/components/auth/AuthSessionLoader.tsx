import { useEffect } from 'react'

import { authApi } from '../../services/authApi'
import { useAuthStore } from '../../stores/authStore'

export function AuthSessionLoader() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const clearAuth = useAuthStore((state) => state.clear)

  useEffect(() => {
    if (!accessToken || user) {
      return
    }

    let isMounted = true

    authApi
      .me()
      .then((currentUser) => {
        if (isMounted) {
          setUser(currentUser)
        }
      })
      .catch(() => {
        if (isMounted) {
          clearAuth()
        }
      })

    return () => {
      isMounted = false
    }
  }, [accessToken, clearAuth, setUser, user])

  return null
}
