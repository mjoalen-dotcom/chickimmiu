/**
 * Null out `avatar` on every admin-role user.
 *
 * 用途：修 Payload 後台右上 Account 按鈕的 broken-image（avatar 欄位指向的
 * media 檔案掛了 → <img> 404 → 顯示 email 前綴當 alt text）。清掉後會 fallback
 * 到 Payload 預設 avatar（姓名首字灰底圓）。使用者如果重新上傳會被
 * Users.avatar.beforeValidate hook 擋掉無效 media ref。
 *
 * 跑法：pnpm payload run src/seed/clearAdminAvatar.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'

process.stdout.write('[clearAdminAvatar] starting\n')

async function main() {
  const payload = await getPayload({ config })
  process.stdout.write('[clearAdminAvatar] payload ready\n')

  const admins = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    limit: 200,
    depth: 0,
  })
  process.stdout.write('[clearAdminAvatar] found ' + admins.docs.length + ' admin user(s)\n')

  let cleared = 0
  for (const u of admins.docs) {
    const avatar = (u as { avatar?: unknown }).avatar
    const email = (u as { email?: string }).email || '(no email)'
    if (avatar == null) {
      process.stdout.write('[clearAdminAvatar] skip ' + email + ' (avatar already empty)\n')
      continue
    }
    await (payload.update as Function)({
      collection: 'users',
      id: u.id,
      data: { avatar: null },
    })
    cleared++
    process.stdout.write('[clearAdminAvatar] cleared avatar for ' + email + '\n')
  }

  process.stdout.write('[clearAdminAvatar] done; cleared ' + cleared + ' avatar(s)\n')
  process.exit(0)
}

main().catch((e) => {
  process.stderr.write('[clearAdminAvatar] ERROR: ' + ((e && e.stack) || e) + '\n')
  process.exit(1)
})
