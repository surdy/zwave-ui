import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFavoritesStore } from '../favorites'

describe('favorites store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('adds and removes favorites in order', () => {
    const store = useFavoritesStore()

    store.toggle(7)
    store.toggle(2)
    expect(store.orderedIds).toEqual([7, 2])
    expect(store.isFavorite(7)).toBe(true)

    store.toggle(7)
    expect(store.orderedIds).toEqual([2])
    expect(store.isFavorite(7)).toBe(false)
  })

  it('persists favorites to localStorage', () => {
    const store = useFavoritesStore()

    store.toggle(3)
    store.toggle(8)

    expect(localStorage.getItem('zwui.favorites')).toBe('[3,8]')

    setActivePinia(createPinia())
    expect(useFavoritesStore().orderedIds).toEqual([3, 8])
  })

  it('falls back to an empty list when storage is invalid', () => {
    localStorage.setItem('zwui.favorites', 'not json')
    setActivePinia(createPinia())

    expect(useFavoritesStore().orderedIds).toEqual([])
  })
})
