export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label = "async-task",
): Promise<T> {
  const logLabel = `[withTimeout] ${label}`;
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((resolve) => {
        setTimeout(() => {
          console.warn(`${logLabel} timed out after ${ms}ms`);
          resolve(fallback);
        }, ms);
      }),
    ]);
  } catch (error) {
    console.warn(`${logLabel} failed`, error);
    return fallback;
  }
}
