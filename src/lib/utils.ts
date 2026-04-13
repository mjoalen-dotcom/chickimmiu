import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合併 class name 的工具函式（shadcn/ui 標配）
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
