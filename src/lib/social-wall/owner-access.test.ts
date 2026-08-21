import assert from 'node:assert/strict'
import test from 'node:test'

import { socialWallOwnerOrAdminAccess } from './owner-access'

test('denies anonymous requests and authenticated users without a stable id', () => {
  assert.equal(socialWallOwnerOrAdminAccess({ req: { user: null } }), false)
  assert.equal(
    socialWallOwnerOrAdminAccess({ req: { user: { id: null, role: 'customer' } } }),
    false,
  )
})

test('allows only the exact platform admin role to bypass owner scoping', () => {
  assert.equal(
    socialWallOwnerOrAdminAccess({ req: { user: { id: 1, role: 'admin' } } }),
    true,
  )
  assert.deepEqual(
    socialWallOwnerOrAdminAccess({ req: { user: { id: 2, role: 'Admin' } } }),
    { owner: { equals: 2 } },
  )
})

test('scopes every non-admin request to the authenticated owner id', () => {
  assert.deepEqual(
    socialWallOwnerOrAdminAccess({ req: { user: { id: 42, role: 'customer' } } }),
    { owner: { equals: 42 } },
  )
  assert.deepEqual(
    socialWallOwnerOrAdminAccess({ req: { user: { id: 'user_abc', role: 'operator' } } }),
    { owner: { equals: 'user_abc' } },
  )
})

test('ignores a forged owner supplied in request data', () => {
  assert.deepEqual(
    socialWallOwnerOrAdminAccess({
      req: { user: { id: 'user_abc', role: 'customer' } },
      data: { owner: 'victim_user' },
    }),
    { owner: { equals: 'user_abc' } },
  )
})
