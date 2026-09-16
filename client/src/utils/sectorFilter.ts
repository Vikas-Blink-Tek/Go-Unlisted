/** Case-insensitive sector match: "Aviation" also matches "Aviation and Tourism sector". */
export function sectorMatches(shareSector: string | undefined | null, selected: string): boolean {
  if (!selected || selected === 'All') return true;
  const share = (shareSector || '').trim().toLowerCase();
  const want = selected.trim().toLowerCase();
  if (!share || !want) return false;
  if (share === want) return true;
  // Parent chip matches longer admin labels ("Financial Services" → "Financial Services (NBFC)")
  if (
    share.startsWith(`${want} `)
    || share.startsWith(`${want}/`)
    || share.startsWith(`${want},`)
    || share.startsWith(`${want} &`)
    || share.startsWith(`${want}(`)
  ) {
    return true;
  }
  return false;
}
