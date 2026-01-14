import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    redirect: '/user-dialogs',
  },
  {
    path: '/tenants',
    name: 'tenants',
    component: () => import('@/pages/tenants'),
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('@/pages/users'),
  },
  {
    path: '/messages',
    name: 'messages',
    component: () => import('@/pages/messages'),
  },
  {
    path: '/dialogs-messages',
    name: 'dialogs-messages',
    component: () => import('@/pages/dialogs-messages'),
  },
  {
    path: '/user-dialogs',
    name: 'user-dialogs',
    component: () => import('@/pages/UserDialogsPage.vue'),
  },
  {
    path: '/db-explorer',
    name: 'db-explorer',
    component: () => import('@/pages/DbExplorerPage.vue'),
  },
  {
    path: '/events-updates',
    name: 'events-updates',
    component: () => import('@/pages/events-updates'),
  },
  {
    path: '/init',
    name: 'init',
    component: () => import('@/pages/InitPage.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
