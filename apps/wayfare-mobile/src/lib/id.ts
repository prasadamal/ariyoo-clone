import { randomUUID } from 'expo-crypto';

/**
 * Random v4 UUID from the platform's secure generator. (The `uuid` package needs
 * crypto.getRandomValues, which Hermes does not provide, so it throws on device.)
 */
export function uuid(): string {
  return randomUUID();
}
