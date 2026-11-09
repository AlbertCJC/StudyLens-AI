const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Pure-JS base64 encoder (React Native has no btoa/Buffer guarantee). Chunked
// so large uploads don't blow the call stack.
export function uint8ToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;
    chunk +=
      B64_CHARS[(triplet >> 18) & 0x3f] +
      B64_CHARS[(triplet >> 12) & 0x3f] +
      (i + 1 < bytes.length ? B64_CHARS[(triplet >> 6) & 0x3f] : '=') +
      (i + 2 < bytes.length ? B64_CHARS[triplet & 0x3f] : '=');
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  if (chunk) parts.push(chunk);
  return parts.join('');
}
