export type SocialWallEnvironment = 'development' | 'production'

export interface DomainPolicyOptions {
  environment: SocialWallEnvironment
}

function parseHost(input: string): { hostname: string; port: string } {
  const value = input.trim()
  if (!value || /[\u0000-\u001f\u007f]/.test(value) || value.includes('*')) {
    throw new Error('Invalid widget host')
  }

  let parsed: URL
  try {
    parsed = new URL(value.includes('://') ? value : `https://${value}`)
  } catch {
    throw new Error('Invalid widget host')
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error('Invalid widget host')
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, '')
  if (!hostname || hostname === '.' || /\s/.test(hostname)) {
    throw new Error('Invalid widget host')
  }

  return { hostname, port: parsed.port }
}

function isLoopbackHostname(hostname: string): boolean {
  const bare = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname

  return (
    bare === 'localhost' ||
    bare.endsWith('.localhost') ||
    /^127(?:\.\d{1,3}){3}$/.test(bare) ||
    bare === '::1' ||
    bare === '0:0:0:0:0:0:0:1'
  )
}

function assertEnvironmentAllowsHost(hostname: string, options: DomainPolicyOptions): void {
  if (options.environment === 'production' && isLoopbackHostname(hostname)) {
    throw new Error('localhost and loopback hosts are only allowed during development')
  }
}

/** Converts a URL or host input into the canonical host used by licenses. */
export function normalizeWidgetHost(_input: string): string {
  const { hostname, port } = parseHost(_input)
  return port ? `${hostname}:${port}` : hostname
}

/** Canonicalizes one exact-host or bounded subdomain-wildcard allowlist entry. */
export function normalizeAllowedHostPattern(
  _input: string,
  _options: DomainPolicyOptions,
): string {
  const value = _input.trim()
  if (value === '*' || value === '*.*' || (value.includes('*') && !value.startsWith('*.'))) {
    throw new Error('Global wildcard licenses are not allowed')
  }

  if (value.startsWith('*.')) {
    if (value.slice(2).includes('*') || value.includes('://')) {
      throw new Error('Invalid wildcard license pattern')
    }

    const { hostname, port } = parseHost(value.slice(2))
    if (port || hostname.split('.').length < 2 || hostname.startsWith('[')) {
      throw new Error('Wildcard licenses require a bounded DNS domain without a port')
    }
    assertEnvironmentAllowsHost(hostname, _options)
    return `*.${hostname}`
  }

  const { hostname, port } = parseHost(value)
  assertEnvironmentAllowsHost(hostname, _options)
  return port ? `${hostname}:${port}` : hostname
}

/** Checks a requesting host against the licensed host patterns. */
export function isWidgetHostAllowed(
  _input: string,
  _allowedHostPatterns: readonly string[],
  _options: DomainPolicyOptions,
): boolean {
  if (_allowedHostPatterns.length === 0) return false

  let requestedHost: string
  let requestedHostname: string
  let requestedPort: string
  try {
    const parsed = parseHost(_input)
    assertEnvironmentAllowsHost(parsed.hostname, _options)
    requestedHostname = parsed.hostname
    requestedPort = parsed.port
    requestedHost = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname
  } catch {
    return false
  }

  return _allowedHostPatterns.some((rawPattern) => {
    let pattern: string
    try {
      pattern = normalizeAllowedHostPattern(rawPattern, _options)
    } catch {
      return false
    }

    if (!pattern.startsWith('*.')) return requestedHost === pattern
    if (requestedPort) return false

    const parent = pattern.slice(2)
    return requestedHostname !== parent && requestedHostname.endsWith(`.${parent}`)
  })
}
