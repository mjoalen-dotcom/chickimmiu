import { createJSONStorage, type StateStorage } from 'zustand/middleware'

const memoryStorage = new Map<string, string>()

const noopStorage: StateStorage = {
  getItem: (name) => memoryStorage.get(name) ?? null,
  setItem: (name, value) => {
    memoryStorage.set(name, value)
  },
  removeItem: (name) => {
    memoryStorage.delete(name)
  },
}

function getBrowserStorage(): StateStorage {
  if (typeof window === 'undefined') return noopStorage

  try {
    const testKey = '__ckm_storage_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return window.localStorage
  } catch {
    return noopStorage
  }
}

export const safeLocalStorage = createJSONStorage(() => getBrowserStorage())
