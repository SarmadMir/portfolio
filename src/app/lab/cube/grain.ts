/** The stone's grain: a small tile of seeded noise, shared by the shader and the CSS cube. */
export const GRAIN_SIZE = 64;

export function grainBytes(seed = 0x5eed): Uint8Array {
  const bytes = new Uint8Array(GRAIN_SIZE * GRAIN_SIZE);
  let state = seed >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[i] = (state >>> 0) & 0xff;
  }
  return bytes;
}
