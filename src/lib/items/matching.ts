function tokens(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[‐‑‒–—-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function closeWord(left: string, right: string) {
  if (left === right || left.includes(right) || right.includes(left)) return true;
  if (Math.abs(left.length - right.length) > 1) return false;
  let row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const next = [i];
    for (let j = 1; j <= right.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(left[i - 1] !== right[j - 1]));
    row = next;
  }
  return row[right.length] <= 1;
}

export type MatchFields = {
  title: string;
  category: string;
  description: string;
  brand?: string | null;
  color?: string | null;
  location: string;
  occurredAt: Date;
};

export function scorePossibleMatch(lost: MatchFields, found: MatchFields) {
  let score = lost.category === found.category ? 18 : 0;
  const titleTokens = [...new Set(tokens(`${lost.title} ${lost.brand ?? ""} ${lost.color ?? ""}`))];
  const foundTitle = tokens(`${found.title} ${found.brand ?? ""} ${found.color ?? ""} ${found.description}`);
  const titleMatches = titleTokens.filter((token) => foundTitle.some((candidate) => closeWord(token, candidate))).length;
  if (titleTokens.length) score += Math.round((titleMatches / titleTokens.length) * 32);
  const searchableFound = tokens(`${found.title} ${found.brand ?? ""} ${found.color ?? ""} ${found.description}`);
  const lostBrand = tokens(lost.brand);
  if (lostBrand.length && lostBrand.some((token) => searchableFound.some((candidate) => closeWord(token, candidate)))) score += 14;
  const lostColor = tokens(lost.color);
  if (lostColor.length && lostColor.some((token) => searchableFound.some((candidate) => candidate === token))) score += 8;
  const lostDescription = [...new Set(tokens(lost.description))];
  const detailMatches = lostDescription.filter((token) => searchableFound.some((candidate) => closeWord(token, candidate))).length;
  if (lostDescription.length) score += Math.min(14, Math.round((detailMatches / Math.min(lostDescription.length, 12)) * 14));
  const locationTokens = tokens(lost.location);
  const foundLocation = tokens(found.location);
  const sharedLocation = locationTokens.filter((token) => foundLocation.some((candidate) => closeWord(token, candidate))).length;
  if (sharedLocation) score += Math.min(8, sharedLocation * 4);
  const daysApart = Math.abs(lost.occurredAt.getTime() - found.occurredAt.getTime()) / 86_400_000;
  if (daysApart <= 2) score += 6;
  else if (daysApart <= 7) score += 4;
  else if (daysApart <= 30) score += 2;
  return Math.min(100, score);
}

export function normalizeSearchText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[‐‑‒–—-]+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().replace(/\s+/g, " ");
}

export function searchTokenVariants(token: string) {
  const variants = new Set([token]);
  if (token.length >= 4) for (let index = 0; index < token.length; index++) variants.add(`${token.slice(0, index)}${token.slice(index + 1)}`);
  return [...variants].filter(Boolean);
}

function searchMatches(token: string, candidate: string) {
  return closeWord(token, candidate) || (token.length >= 4 && searchTokenVariants(token).some((variant) => candidate.includes(variant)));
}

export function searchRelevance(query: string, fields: Array<string | null | undefined>) {
  const queryTokens = normalizeSearchText(query).split(" ").filter(Boolean);
  const fieldTokens = fields.flatMap((field) => tokens(field));
  if (!queryTokens.length) return 0;
  const coverage = queryTokens.filter((token) => fieldTokens.some((candidate) => searchMatches(token, candidate))).length;
  const titleTokens = tokens(fields[0]);
  const titleCoverage = queryTokens.filter((token) => titleTokens.some((candidate) => searchMatches(token, candidate))).length;
  return (coverage / queryTokens.length) * 60 + (titleCoverage / queryTokens.length) * 40;
}
