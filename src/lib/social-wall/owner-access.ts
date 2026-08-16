export interface SocialWallAccessUser {
  id?: string | number | null
  role?: string | null
}

export interface SocialWallOwnerAccessArgs {
  req: {
    user?: SocialWallAccessUser | null
  }
  data?: Record<string, unknown> | null
}

export type SocialWallOwnerWhere = {
  owner: {
    equals: string | number
  }
}

export type SocialWallOwnerAccessResult = boolean | SocialWallOwnerWhere

/**
 * Lets platform admins access all rows and scopes every other authenticated user
 * to rows whose owner is the authenticated user.
 */
export function socialWallOwnerOrAdminAccess(
  _args: SocialWallOwnerAccessArgs,
): SocialWallOwnerAccessResult {
  const user = _args.req.user
  if (!user || user.id === null || user.id === undefined || user.id === '') return false
  if (user.role === 'admin') return true

  return {
    owner: {
      equals: user.id,
    },
  }
}
