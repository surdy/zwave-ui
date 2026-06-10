import { defineStore } from 'pinia'

const FAVORITES_KEY = 'zwui.favorites'

interface FavoritesState {
  ids: number[]
}

function readFavorites(): number[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is number => Number.isInteger(id) && id > 0)
  } catch {
    return []
  }
}

function persist(ids: number[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

export const useFavoritesStore = defineStore('favorites', {
  state: (): FavoritesState => ({
    ids: readFavorites(),
  }),
  getters: {
    orderedIds: (state): number[] => [...state.ids],
    isFavorite: (state) => (id: number): boolean => state.ids.includes(id),
  },
  actions: {
    toggle(id: number) {
      if (!Number.isInteger(id) || id <= 0) return
      if (this.ids.includes(id)) {
        this.ids = this.ids.filter((favoriteId) => favoriteId !== id)
      } else {
        this.ids = [...this.ids, id]
      }
      persist(this.ids)
    },
  },
})
