import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 512;
const MAX_CHUNKS = 80;
let writeId = 0;

type Manifest = {
  version: string;
  count: number;
};

function isManifest(value: unknown): value is Manifest {
  return (
    typeof value === 'object'
    && value !== null
    && 'version' in value
    && 'count' in value
    && typeof value.version === 'string'
    && typeof value.count === 'number'
    && Number.isInteger(value.count)
    && value.count >= 1
    && value.count <= MAX_CHUNKS
  );
}

function storagePrefix(key: string) {
  return `nearside.auth.${encodeURIComponent(key)}`;
}

async function getManifest(key: string): Promise<Manifest | null> {
  const raw = await SecureStore.getItemAsync(`${storagePrefix(key)}.manifest`);
  if (!raw) return null;

  const manifest: unknown = JSON.parse(raw);
  if (!isManifest(manifest)) {
    throw new Error('Stored sign-in data is invalid. Sign in again to continue.');
  }
  return manifest;
}

export const authStorage = {
  async getItem(key: string) {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);

    const manifest = await getManifest(key);
    if (!manifest) return null;

    const prefix = storagePrefix(key);
    const chunks = await Promise.all(
      Array.from({ length: manifest.count }, (_, index) =>
        SecureStore.getItemAsync(`${prefix}.${manifest.version}.${index}`),
      ),
    );
    if (chunks.some((chunk) => chunk === null)) {
      throw new Error('Stored sign-in data is incomplete. Sign in again to continue.');
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }

    const parts = Array.from(
      { length: Math.max(1, Math.ceil(value.length / CHUNK_SIZE)) },
      (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    );
    if (parts.length > MAX_CHUNKS) {
      throw new Error('Sign-in data is too large to store securely on this device.');
    }

    const prefix = storagePrefix(key);
    const previous = await getManifest(key);
    const version = `${Date.now().toString(36)}-${(++writeId).toString(36)}`;
    await Promise.all(
      parts.map((part, index) =>
        SecureStore.setItemAsync(`${prefix}.${version}.${index}`, part),
      ),
    );
    await SecureStore.setItemAsync(
      `${prefix}.manifest`,
      JSON.stringify({ version, count: parts.length } satisfies Manifest),
    );

    if (previous) {
      await Promise.all(
        Array.from({ length: previous.count }, (_, index) =>
          SecureStore.deleteItemAsync(`${prefix}.${previous.version}.${index}`),
        ),
      );
    }
  },

  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
      return;
    }

    const prefix = storagePrefix(key);
    const manifest = await getManifest(key);
    await SecureStore.deleteItemAsync(`${prefix}.manifest`);
    if (manifest) {
      await Promise.all(
        Array.from({ length: manifest.count }, (_, index) =>
          SecureStore.deleteItemAsync(`${prefix}.${manifest.version}.${index}`),
        ),
      );
    }
  },
};
