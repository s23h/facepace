import { MMKV } from "react-native-mmkv";
import * as SecureStore from "expo-secure-store"
import * as Crypto from "expo-crypto"

const fetchOrGenerateEncryptionKey = (): string => {
  const encryptionKey = SecureStore.getItem("session-encryption-key")

  if (encryptionKey) {
    return encryptionKey
  } else {
    const uuid = Crypto.randomUUID()
    SecureStore.setItem("session-encryption-key", uuid)
    return uuid
  }
}


export const storage = new MMKV({
  id: "session",
  encryptionKey: fetchOrGenerateEncryptionKey(),
});

/**
 * Loads a string from storage.
 *
 * @param key The key to fetch.
 */
export function loadString(key: string): string | undefined {
  try {
    return storage.getString(key)
  } catch {
    // not sure why this would fail... even reading the RN docs I'm unclear
    return undefined
  }
}

/**
 * Saves a string to storage.
 *
 * @param key The key to fetch.
 * @param value The value to store.
 */
export function saveString(key: string, value: string): boolean {
  try {
    storage.set(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * Loads something from storage and runs it thru JSON.parse.
 *
 * @param key The key to fetch.
 */
export function load(key: string): unknown | undefined {
  try {
    const almostThere = loadString(key)
    if (almostThere) {
      try {
        return JSON.parse(almostThere)
      } catch {
        return almostThere // Return the string if it's not a valid JSON
      }
    }
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Saves an object to storage.
 *
 * @param key The key to fetch.
 * @param value The value to store.
 */
export function save(key: string, value: unknown): boolean {
  try {
    saveString(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * Removes something from storage.
 *
 * @param key The key to kill.
 */
export function remove(key: string): void {
  try {
    storage.delete(key)
  } catch { }
}

/**
 * Burn it all to the ground.
 */
export function clear(): void {
  try {
    storage.clearAll()
  } catch { }
}

export const SessionStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return loadString(key) ?? null
  },
  setItem: async (key: string, value: string): Promise<void> => {
    saveString(key, value)
  },
  removeItem: async (key: string): Promise<void> => {
    remove(key)
  },
}