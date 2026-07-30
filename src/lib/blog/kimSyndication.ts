type BlogDocument = Record<string, unknown>

export async function triggerKimBlogDeploy(
  event: 'published' | 'unpublished' | 'deleted',
  doc: BlogDocument,
): Promise<void> {
  const hookUrl = process.env.KIM_BLOG_DEPLOY_HOOK_URL?.trim()
  if (!hookUrl) return

  let parsed: URL
  try {
    parsed = new URL(hookUrl)
  } catch {
    console.error('[kim-blog] KIM_BLOG_DEPLOY_HOOK_URL is invalid')
    return
  }
  if (
    parsed.protocol !== 'https:' &&
    !(process.env.NODE_ENV !== 'production' && parsed.hostname === '127.0.0.1')
  ) {
    console.error('[kim-blog] deploy hook must use HTTPS')
    return
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  const token = process.env.KIM_BLOG_DEPLOY_HOOK_TOKEN?.trim()
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const response = await fetch(parsed, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event,
        collection: 'blog-posts',
        id: doc.id,
        slug: doc.slug,
        occurredAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) {
      console.error(`[kim-blog] deploy hook returned HTTP ${response.status}`)
    }
  } catch (error) {
    console.error(
      '[kim-blog] deploy hook failed:',
      error instanceof Error ? error.message : String(error),
    )
  }
}
