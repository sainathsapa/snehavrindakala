/**
 * Bilingual query expansion.
 *
 * A Hindi query works for the *names* of traditions — "मधुबनी" reaches the
 * Madhubani page because the art-form table carries `name_hi`. It did not work
 * for ordinary words: "मिट्टी" (clay) found nothing, although the shop sells a
 * terracotta vase, and "चांदी" (silver) found nothing although it sells silver
 * filigree. The room was speaking Hindi in the nav and English in the search
 * box.
 *
 * Two rules keep this honest:
 *
 *  1. **Alternatives, not additions.** Synonyms are OR-groups. Adding "clay"
 *     next to "मिट्टी" as another required word would mean nothing matched
 *     unless both were present, which is worse than the bug it fixes.
 *  2. **Small and curated.** This is a shop's vocabulary — materials, colours,
 *     animals, object kinds — not a translation service. A word that is not
 *     here still works when it appears in a title in either script.
 */

/** Hindi word → the English words a work might use for the same thing. */
export const HINDI_TO_ENGLISH: Record<string, string[]> = {
  // Materials
  "मिट्टी": ["terracotta", "clay", "earthen"],
  "चांदी": ["silver"],
  "सोना": ["gold"],
  "पीतल": ["brass"],
  "तांबा": ["copper"],
  "लकड़ी": ["wood", "wooden"],
  "कागज़": ["paper"],
  "कागज": ["paper"],
  "कपड़ा": ["cloth", "textile", "fabric"],
  "सूती": ["cotton"],
  "रेशम": ["silk"],
  "ऊन": ["wool"],
  "रंग": ["pigment", "paint", "colour", "color"],
  "स्याही": ["ink"],
  "सोने की पत्ती": ["gold leaf"],

  // Colours
  "नीला": ["indigo", "blue"],
  "लाल": ["red", "vermilion"],
  "हरा": ["green"],
  "पीला": ["yellow", "ochre"],
  "काला": ["black"],
  "सफेद": ["white"],
  "संतरी": ["orange", "ochre"],
  "गुलाबी": ["pink"],

  // Animals and plants a motif is named for
  "हाथी": ["elephant"],
  "मछली": ["fish"],
  "पक्षी": ["bird"],
  "मोर": ["peacock"],
  "पेड़": ["tree"],
  "फूल": ["flower", "lotus"],
  "कमल": ["lotus"],
  "सांप": ["snake", "serpent"],
  "गाय": ["cow"],
  "शेर": ["lion", "tiger"],
  "बाघ": ["tiger"],

  // Kinds of object
  "चित्र": ["painting", "picture"],
  "चित्रकारी": ["painting"],
  "कला": ["art"],
  "शिल्प": ["craft"],
  "मूर्ति": ["sculpture", "idol"],
  "बर्तन": ["vessel", "pot"],
  "फूलदान": ["vase"],
  "गहने": ["jewellery", "jewelry", "earrings"],
  "झुमका": ["earrings"],
  "साड़ी": ["saree"],
  "दुपट्टा": ["stole", "scarf"],
  "चादर": ["throw", "bedcover"],
  "कंबल": ["blanket"],
  "चप्पल": ["footwear", "slippers"],
  "बस्ता": ["bag"],

  // Places and people
  "राजस्थान": ["rajasthan"],
  "बीकानेर": ["bikaner"],
  "मिथिला": ["mithila", "madhubani"],
  "बंगाल": ["bengal", "kalighat"],
  "ओडिशा": ["odisha", "pattachitra"],
  "गुजरात": ["gujarat", "kutch"],
  "कच्छ": ["kutch"],
  "कारीगर": ["artisan", "craftsperson", "maker"],
  "शिल्पकार": ["craftsperson", "artisan"],
};

/**
 * One group per query word: the word itself plus any English alternatives.
 * Preserves order so a caller can treat the first entry as the primary token for
 * scoring.
 */
export function queryGroups(query: string): string[][] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.map((word) => {
    const alternatives = HINDI_TO_ENGLISH[word] ?? [];
    return [word, ...alternatives];
  });
}

/**
 * True when every group is satisfied by at least one of its alternatives.
 *
 * `groups` comes from `queryGroups`, so a two-word query still requires both
 * words — "चांदी बर्तन" must find a silver vessel, not every silver thing and
 * every vessel.
 */
export function matchesGroups(haystack: string, groups: string[][]): boolean {
  if (groups.length === 0) return false;
  const h = haystack.toLowerCase();
  return groups.every((group) => group.some((needle) => needle && h.includes(needle)));
}
