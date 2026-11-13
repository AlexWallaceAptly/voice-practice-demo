const FILLERS = new Set(['um', 'uh', 'erm', 'like', 'ah', 'hmm', 'huh'])

const LEAD_INS = [
  'i think the answer is',
  'the answer is',
  'i think its',
  "i think it's",
  'i think it is',
  'maybe its',
  "maybe it's",
  'maybe it is',
  'i believe its',
  "i believe it's",
  'i believe it is',
  'it is',
  "it's",
  'its',
  'maybe',
]

const ARTICLES = new Set(['a', 'an', 'the'])

const ONES: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
}

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}

/** Lowercase, strip punctuation, collapse whitespace, normalize D.C., drop fillers. */
export function normalizeText(input: string): string {
  let text = input.toLowerCase()

  // Normalize D.C. variants before stripping punctuation
  text = text.replace(/\bd\.?\s*c\.?\b/g, 'dc')

  text = text.replace(/[^a-z0-9\s]/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()

  for (const lead of LEAD_INS) {
    if (text.startsWith(lead + ' ')) {
      text = text.slice(lead.length).trim()
      break
    }
    if (text === lead) {
      text = ''
      break
    }
  }

  const tokens = text
    .split(' ')
    .filter((t) => t.length > 0 && !FILLERS.has(t))

  return tokens.join(' ')
}

/** Drop articles for comparison. */
export function stripArticles(text: string): string {
  return text
    .split(/\s+/)
    .filter((t) => t.length > 0 && !ARTICLES.has(t))
    .join(' ')
}

/** Convert number words in a token stream to digit strings where possible. */
export function normalizeNumbers(text: string): string {
  const tokens = text.split(/\s+/).filter(Boolean)
  const out: string[] = []
  let i = 0

  while (i < tokens.length) {
    const t = tokens[i]!

    if (/^\d+$/.test(t)) {
      out.push(t)
      i += 1
      continue
    }

    if (t in TENS) {
      const tens = TENS[t]!
      const next = tokens[i + 1]
      if (next && next in ONES && ONES[next]! < 10) {
        out.push(String(tens + ONES[next]!))
        i += 2
        continue
      }
      out.push(String(tens))
      i += 1
      continue
    }

    if (t in ONES) {
      out.push(String(ONES[t]!))
      i += 1
      continue
    }

    // hyphenated like twenty-seven already split by punctuation strip
    out.push(t)
    i += 1
  }

  return out.join(' ')
}

/** Full normalization pipeline for matching. */
export function normalizeForMatch(input: string): string {
  const base = normalizeText(input)
  const numbered = normalizeNumbers(base)
  return stripArticles(numbered)
}

export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}
