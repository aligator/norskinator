/** Norwegian number, percent and greeting formatting. */

const integerFormat = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });

export function formatNumber(value: number): string {
  return integerFormat.format(value);
}

/** The learner's earnings, called XP in the code: «1 240 kr». */
export function formatMoney(amount: number): string {
  return `${formatNumber(amount)} kr`;
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

/** When an item comes back: «om litt» after a miss, «i morgen», «om 5 dager». */
export function formatComesBack(due: number, now: number): string {
  const days = Math.round((due - now) / 86_400_000);

  if (due <= now) {
    return 'nå';
  }

  if (days < 1) {
    return 'om litt';
  }

  return days === 1 ? 'i morgen' : `om ${pluralDays(days)}`;
}

const dateFormat = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });

/** «tirsdag 14. oktober». */
export function formatDate(timestamp: number): string {
  return dateFormat.format(timestamp);
}

export function pluralTimes(count: number): string {
  return count === 1 ? '1 gang' : `${formatNumber(count)} ganger`;
}
