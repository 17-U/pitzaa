export function isDateInFuture(value: string): boolean {
  return new Date(value).getTime() > Date.now();
}
