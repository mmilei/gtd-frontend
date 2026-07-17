import { describe, expect, it } from 'vitest'
import { itemMatches, normFacet } from './facets'
import type { Item } from './types'

describe('normFacet', () => {
  it('lowercases, trims and strips diacritics', () => {
    expect(normFacet(' Ferretería ')).toBe('ferreteria')
    expect(normFacet('EJERCICIO')).toBe('ejercicio')
    expect(normFacet('colchón')).toBe('colchon')
  })
})

describe('itemMatches', () => {
  const item: Item = {
    file: '1.md',
    title: 'Comprar tornillos',
    tags: ['Compras', 'hogar'],
    project: 'gtd-frontend ',
    location: 'Ferretería',
    area: 'trabajo',
  }

  it('matches each facet accent/case-insensitively', () => {
    expect(itemMatches(item, 'tag', 'compras')).toBe(true)
    expect(itemMatches(item, 'project', 'gtd-frontend')).toBe(true)
    expect(itemMatches(item, 'location', 'ferreteria')).toBe(true)
    expect(itemMatches(item, 'area', 'Trabajo')).toBe(true)
  })

  it('does not match a different value', () => {
    expect(itemMatches(item, 'tag', 'salud')).toBe(false)
    expect(itemMatches(item, 'project', 'java-gtd')).toBe(false)
    expect(itemMatches(item, 'location', 'farmacia')).toBe(false)
    expect(itemMatches(item, 'area', 'salud')).toBe(false)
  })

  it('treats missing values as no match', () => {
    const bare: Item = { file: '2.md' }
    expect(itemMatches(bare, 'tag', 'compras')).toBe(false)
    expect(itemMatches(bare, 'project', 'gtd-frontend')).toBe(false)
    expect(itemMatches(bare, 'location', 'ferreteria')).toBe(false)
    expect(itemMatches(bare, 'area', 'trabajo')).toBe(false)
  })
})
