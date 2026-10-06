/** Norwegian number, percent and greeting formatting. */

const integerFormat = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });

export function formatNumber(value: number): string {
  return integerFormat.format(value);
}

/** Norwegian style puts a space before the percent sign: «87 %». */
export function formatPercent(ratio: number): string {
  return `${formatNumber(Math.round(ratio * 100))} %`;
}

export function greeting(now: Date): string {
  const hour = now.getHours();

  if (hour < 5) {
    return 'God natt';
  }

  if (hour < 10) {
    return 'God morgen';
  }

  if (hour < 18) {
    return 'God dag';
  }

  return 'God kveld';
}

export function pluralDays(count: number): string {
  return count === 1 ? '1 dag' : `${formatNumber(count)} dager`;
}
