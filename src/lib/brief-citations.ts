/**
 * Transforms daily brief markdown from inline source links to numbered footnotes.
 *
 * Input:  "**Topic**: Detail text ([source](https://example.com/page))"
 * Output: "**Topic**: Detail text [1]"
 * + footnotes array with number, url, name
 */

export interface Footnote {
  number: number;
  url: string;
  name: string;
}

export interface TransformedBrief {
  body: string;
  footnotes: Footnote[];
}

const SOURCE_LINK_PATTERN = /\(\[source\]\((https?:\/\/[^)]+)\)\)/g;

export function transformBriefCitations(
  body: string,
  sourceUrls?: string[] | null,
  sourceNames?: string[] | null,
): TransformedBrief {
  if (!body) return { body: "", footnotes: [] };

  const urlToNumber = new Map<string, number>();
  const footnotes: Footnote[] = [];
  let counter = 0;

  // Build a URL → name lookup from the article's source metadata
  const urlToName = new Map<string, string>();
  if (sourceUrls && sourceNames) {
    for (let i = 0; i < sourceUrls.length; i++) {
      if (sourceUrls[i] && sourceNames[i]) {
        urlToName.set(sourceUrls[i], sourceNames[i]);
      }
    }
  }

  const transformed = body.replaceAll(SOURCE_LINK_PATTERN, (_match, url: string) => {
    let num = urlToNumber.get(url);
    if (num === undefined) {
      counter++;
      num = counter;
      urlToNumber.set(url, num);

      // Determine display name: prefer source_names, fall back to hostname
      let name = urlToName.get(url);
      if (!name) {
        try {
          name = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          name = url;
        }
      }

      footnotes.push({ number: num, url, name });
    }
    return `[${num}]`;
  });

  return { body: transformed, footnotes };
}
