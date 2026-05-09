const avatarCache = new Map<string, string>()

/**
 * Fetches an image on the server, resizes it via weserv.nl, and converts it to a 
 * Base64 data URI. This is the "nuclear option" for the Car Thing's older 
 * browser which may have outdated SSL certificates or network restrictions 
 * that prevent it from reaching TikTok/Twitch CDNs directly.
 */
export async function proxyImageToBase64(url: string | undefined, size = 48): Promise<string | undefined> {
  if (!url || url.startsWith('data:')) return url
  
  const cacheKey = `${url}_${size}`
  if (avatarCache.has(cacheKey)) return avatarCache.get(cacheKey)

  try {
    // 1. Process through weserv to get a tiny 48x48 image and normalize formats
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${size}&h=${size}&fit=cover`
    
    const response = await fetch(proxyUrl)
    if (!response.ok) return url
    
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const dataUri = `data:${contentType};base64,${base64}`
    
    if (avatarCache.size > 1000) avatarCache.clear()
    avatarCache.set(cacheKey, dataUri)
    return dataUri
  } catch (err) {
    // Fallback to original URL if the proxy fetch fails
    return url
  }
}
