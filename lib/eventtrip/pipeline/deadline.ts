export class DeadlineExceededError extends Error {
  deadlineMs: number;

  constructor(deadlineMs: number) {
    super(`Operation exceeded deadline of ${deadlineMs}ms`);
    this.name = "DeadlineExceededError";
    this.deadlineMs = deadlineMs;
  }
}

export async function runWithDeadline<T>(
  operation: () => Promise<T>,
  deadlineMs: number
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new DeadlineExceededError(deadlineMs));
        }, deadlineMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
