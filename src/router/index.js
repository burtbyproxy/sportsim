import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'title',
    component: () => import('../components/layout/TitleScreen.vue'),
  },
  {
    path: '/game',
    name: 'game',
    component: () => import('../components/layout/GameScreen.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
