import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strip markdown formatting from text to display clean snippets.
 * Removes headers, bold, italic, code, and links.
 */
export function stripMarkdown(text: string): string {
  return text
    .replaceAll(/#{1,6}\s*/g, '')        // headers
    .replaceAll(/\*\*(.*?)\*\*/g, '$1')  // bold
    .replaceAll(/\*(.*?)\*/g, '$1')      // italic
    .replaceAll(/`(.*?)`/g, '$1')        // inline code
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .trim();
}
