type RedirectLocation = {
  pathname?: string
  search?: string
  hash?: string
}

type AuthRedirectState = {
  from?: RedirectLocation | string | null
}

function safeInternalPath(path: string | null | undefined) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return null
  }
  return path
}

function getPathFromRedirect(from: AuthRedirectState['from']) {
  if (typeof from === 'string') {
    return safeInternalPath(from)
  }

  if (!from?.pathname) {
    return null
  }

  return safeInternalPath(`${from.pathname}${from.search ?? ''}${from.hash ?? ''}`)
}

export function createAuthRedirectState(location: RedirectLocation): AuthRedirectState {
  return {
    from: {
      pathname: location.pathname ?? '/',
      search: location.search ?? '',
      hash: location.hash ?? '',
    },
  }
}

export function getAuthRedirectPath(state: unknown, fallback = '/dashboard') {
  const path = getPathFromRedirect((state as AuthRedirectState | null)?.from)
  return path ?? fallback
}

export function preserveAuthRedirectState(state: unknown) {
  const from = (state as AuthRedirectState | null)?.from
  return getPathFromRedirect(from) ? ({ from } satisfies AuthRedirectState) : undefined
}
