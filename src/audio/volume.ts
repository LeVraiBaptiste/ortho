// Compute RMS (Root Mean Square) of an audio buffer
// Returns a value between 0 and 1
export const computeRMS = (buffer: Float32Array): number => {
  if (buffer.length === 0) return 0;

  let sumOfSquares = 0;
  for (let i = 0; i < buffer.length; i++) {
    sumOfSquares += buffer[i] * buffer[i];
  }

  const rms = Math.sqrt(sumOfSquares / buffer.length);

  return Math.min(1, Math.max(0, rms));
};
