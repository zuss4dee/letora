export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label = "async-task",
): Promise<T> {
  const timerLabel = `[withTimeout] ${label}`;
  console.time(timerLabel);
  try {
    const result = await Promise.race<T>([
      promise,
      new Promise<T>((resolve) => {
        setTimeout(() => {
          console.warn(`${timerLabel} timed out after ${ms}ms`);
          resolve(fallback);
        }, ms);
      }),
    ]);
    return result;
  } catch (error) {
    console.warn(`${timerLabel} failed`, error);
    return fallback;
  } finally {
    console.timeEnd(timerLabel);
  }
}
