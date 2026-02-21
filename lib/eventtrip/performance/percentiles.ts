export function calculatePercentile(
  values: number[],
  percentile: number
): number {
  if (values.length === 0) {
    return 0;
  }

  const normalizedPercentile = Math.min(1, Math.max(0, percentile));
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(
    0,
    Math.ceil(sorted.length * normalizedPercentile) - 1
  );

  return sorted[index] ?? 0;
}
