const GIPHY_API_URL = 'https://api.giphy.com/v1/gifs'
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY as string | undefined

export type GiphyGif = {
  id: string
  title: string
  previewUrl: string
  imageUrl: string
}

type GiphyImage = {
  url?: string
  webp?: string
  width?: string
  height?: string
}

type GiphyApiGif = {
  id: string
  title?: string
  images?: {
    fixed_width?: GiphyImage
    fixed_width_small?: GiphyImage
    downsized_medium?: GiphyImage
    original?: GiphyImage
  }
}

type GiphyResponse = {
  data?: GiphyApiGif[]
}

function hasGiphyApiKey() {
  return Boolean(GIPHY_API_KEY?.trim())
}

function toGiphyGif(item: GiphyApiGif): GiphyGif | null {
  const previewUrl = item.images?.fixed_width_small?.webp ?? item.images?.fixed_width_small?.url
  const imageUrl =
    item.images?.downsized_medium?.url ??
    item.images?.fixed_width?.url ??
    item.images?.original?.url ??
    item.images?.fixed_width?.webp ??
    item.images?.original?.webp

  if (!previewUrl || !imageUrl) {
    return null
  }

  return {
    id: item.id,
    title: item.title?.trim() || 'GIF Giphy',
    previewUrl,
    imageUrl,
  }
}

async function requestGiphy(path: string, params: Record<string, string | number>) {
  if (!hasGiphyApiKey()) {
    throw new Error('GIPHY_API_KEY_MISSING')
  }

  const url = new URL(`${GIPHY_API_URL}${path}`)
  url.searchParams.set('api_key', GIPHY_API_KEY ?? '')
  url.searchParams.set('rating', 'g')
  url.searchParams.set('lang', 'fr')

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('GIPHY_REQUEST_FAILED')
  }

  const payload = (await response.json()) as GiphyResponse
  return (payload.data ?? []).map(toGiphyGif).filter((gif): gif is GiphyGif => Boolean(gif))
}

export const giphyApi = {
  hasApiKey: hasGiphyApiKey,
  search: (query: string, limit = 18) => requestGiphy('/search', { q: query, limit }),
  trending: (limit = 18) => requestGiphy('/trending', { limit }),
}
