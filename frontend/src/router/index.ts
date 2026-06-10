import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
  },
]

if (import.meta.env.DEV) {
  routes.push({
    path: '/_components',
    name: 'kitchen-sink',
    component: () => import('../views/KitchenSinkView.vue'),
  })
}

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
