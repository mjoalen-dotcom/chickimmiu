import type { Access, CollectionConfig, GlobalConfig } from 'payload'

export const isOperator = (user: unknown): boolean =>
  Boolean(
    user &&
      typeof user === 'object' &&
      (user as { role?: unknown }).role === 'operator',
  )

export const isAdminOrOperator: Access = ({ req: { user } }) =>
  Boolean(user && (user.role === 'admin' || user.role === 'operator'))

const allowOperator = (base: Access | undefined): Access => async (args) => {
  if (isOperator(args.req.user)) return true
  return base ? await base(args) : true
}

const denyOperator = (base: Access | undefined): Access => async (args) => {
  if (isOperator(args.req.user)) return false
  return base ? await base(args) : true
}

/**
 * Operator 可讀、新增、修改日常營運資料，但刪除權限完整沿用原設定。
 * 因此 operator 不會因這個 wrapper 取得任何 collection delete 權限。
 */
export const withOperatorManage = (config: CollectionConfig): CollectionConfig => ({
  ...config,
  access: {
    ...config.access,
    read: allowOperator(config.access?.read),
    create: allowOperator(config.access?.create),
    update: allowOperator(config.access?.update),
    delete: denyOperator(config.access?.delete),
  },
})

/** 內容型 Global 可由 operator 編輯；原本的 public read 規則保持不變。 */
export const withOperatorGlobalUpdate = (config: GlobalConfig): GlobalConfig => ({
  ...config,
  access: {
    ...config.access,
    update: allowOperator(config.access?.update),
  },
})

/** 系統設定 Global 僅在 admin 後台顯示；不改變既有前台 API read 規則。 */
export const adminOnlyGlobal = (config: GlobalConfig): GlobalConfig => ({
  ...config,
  admin: {
    ...config.admin,
    hidden: ({ user }) => user?.role !== 'admin',
  },
})
