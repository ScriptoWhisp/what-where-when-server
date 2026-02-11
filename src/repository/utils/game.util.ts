export function parseDateOfEvent(input: string): Date {
  // Expected DD-MM-YYYY
  const parts = input.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid date_of_event: ${input}`);
  }
  const [d, m, y] = parts;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

export function formatDateOfEvent(date: Date): string {
  // DD-MM-YYYY in UTC
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${d}-${m}-${y}`;
}

export function generate4DigitPasscode(): number {
  return 1000 + Math.floor(Math.random() * 9000);
}

export function gameUpdatedAt(game: {
  modifiedAt: Date | null;
  createdAt: Date;
}): Date {
  return game.modifiedAt ?? game.createdAt;
}

export function gameVersion(game: {
  modifiedAt: Date | null;
  createdAt: Date;
}): number {
  return Math.floor(gameUpdatedAt(game).getTime() / 1000);
}
