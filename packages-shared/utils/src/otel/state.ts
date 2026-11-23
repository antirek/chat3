let enabled = false;

export function setEnabled(value: boolean): void {
  enabled = Boolean(value);
}

export function isEnabled(): boolean {
  return enabled;
}
