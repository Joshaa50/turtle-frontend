import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeInput(value: string): string {
  const rawValue = value.replace(/\D/g, '');
  let formatted = rawValue;
  if (formatted.length > 4) formatted = formatted.slice(0, 4);
  if (formatted.length > 2) {
    formatted = `${formatted.slice(0, 2)}:${formatted.slice(2)}`;
  }
  return formatted;
}
