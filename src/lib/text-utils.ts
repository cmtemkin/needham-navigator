/**
 * Shared text utilities for rendering content in the UI.
 */

/**
 * Strip internal LLM metadata (e.g. USED_SOURCES lines) before displaying to users.
 */
export function stripInternalMetadata(text: string): string {
  return text.replace(/\n?USED_SOURCES:\s*.+?(?:\n|$)/gi, "\n").replace(/^\n+|\n+$/g, "").trim();
}

/**
 * Strip markdown syntax for plain-text card previews.
 * Handles images, links, bold, italic, headings, and bullet characters.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, "")        // images ![alt](url)
    .replace(/\[([^\]]*)\]\(.*?\)/g, "$1")   // links [text](url) → keep link text
    .replace(/\*\*(.*?)\*\*/g, "$1")         // bold **text** → text
    .replace(/\*(.*?)\*/g, "$1")             // italic *text* → text
    .replace(/#{1,6}\s/g, "")               // headings
    .replace(/[•·]\s*/g, "")                // bullet characters
    .replace(/\s{2,}/g, " ")               // collapse whitespace
    .trim();
}

/**
 * Extract a meaningful preview snippet from content.
 * Strips markdown, finds sentence boundaries, avoids mid-sentence truncation.
 */
export function extractPreviewText(text: string, maxLength = 150): string {
  const stripped = stripMarkdown(text);

  // Split on sentence-ending punctuation followed by whitespace
  const sentences = stripped
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 20);

  if (sentences.length === 0) {
    if (stripped.length <= maxLength) return stripped;
    const truncated = stripped.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
  }

  let preview = "";
  for (const sentence of sentences) {
    if ((preview + " " + sentence).length > maxLength && preview) break;
    preview = preview ? preview + " " + sentence : sentence;
  }

  if (preview.length <= maxLength) return preview;
  const truncated = preview.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

/**
 * Format a date string as a relative time (e.g. "5 minutes ago" or "3h ago").
 *
 * @param dateString  ISO date string (or any string parseable by `new Date()`)
 * @param compact     If true, use short format ("5m ago"); otherwise "5 minutes ago"
 */
export function formatRelativeTime(dateString: string, compact?: boolean): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Guard against future-dated items (timezone mismatch, bad data)
  if (diffMs < 0) return "Just now";

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (compact) {
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
  } else {
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
