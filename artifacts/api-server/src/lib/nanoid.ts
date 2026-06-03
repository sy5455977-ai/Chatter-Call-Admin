import { randomBytes } from "crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function nanoid(size = 12): string {
  const bytes = randomBytes(size);
  let result = "";
  for (let i = 0; i < size; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}
