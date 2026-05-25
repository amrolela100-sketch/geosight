import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class merger. Prefer over `clsx` alone so duplicate
 * utility classes (e.g. `px-2 px-4`) collapse to the last-wins value. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
