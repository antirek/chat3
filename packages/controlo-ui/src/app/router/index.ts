import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/pages/UserDialogsPage.vue'),
  },
  {
    path: '/tenants',
    name: 'tenants',
    component: () => import('@/pages/TenantsPage.vue'),
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('@/pages/UsersPage.vue'),
  },
  {
    path: '/messages',
    name: 'messages',
    component: () => import('@/pages/MessagesPage.vue'),
  },
  {
    path: '/dialogs-messages',
    name: 'dialogs-messages',
    component: () => import('@/pages/DialogsMessagesPage.vue'),
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
    component: () => import('@/pages/EventsUpdatesPage.vue'),
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
