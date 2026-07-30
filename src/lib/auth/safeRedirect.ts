export function safeInternalRedirect(
  value: string | null | undefined,
  fallback = '/account',
): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\r\n]/.test(value)
  ) {
    return fallback
  }
  return value
}
