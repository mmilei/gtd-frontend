import type { Facet, Item } from './types'

/**
 * Canonical form for facet comparison: trimmed, lowercased, diacritics stripped. The vault is
 * written in Spanish — without this, "Ferretería" and "ferreteria" would be two different
 * facets and a localized area value with different casing would silently match nothing.
 */
export function normFacet(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

const sameFacetValue = (a: string | null | undefined, b: string) => normFacet(a ?? '') === normFacet(b)

/** How each facet decides whether an item belongs to `value`. New facets add one arm here. */
export function itemMatches(item: Item, facet: Facet, value: string): boolean {
  switch (facet) {
    case 'tag':
      return (item.tags ?? []).some(t => sameFacetValue(t, value))
    case 'project':
      return sameFacetValue(item.project, value)
    case 'location':
      return sameFacetValue(item.location, value)
    case 'area':
      return sameFacetValue(item.area, value)
    default: {
      // Compile-time guard: adding a Facet member without a matching case above is a type error
      // here, instead of a silent runtime "matches nothing".
      const _exhaustive: never = facet
      return _exhaustive
    }
  }
}
