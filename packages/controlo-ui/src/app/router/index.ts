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
    path: '/packs',
    name: 'packs',
    component: () => import('@/pages/packs'),
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('@/pages/chat'),
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
    path: '/topics-messages',
    name: 'topics-messages',
    component: () => import('@/pages/topics-messages'),
  },
  {
    path: '/user-dialogs',
    name: 'user-dialogs',
    component: () => import('@/pages/user-dialogs'),
  },
  {
    path: '/db-explorer',
    name: 'db-explorer',
    component: () => import('@/pages/db-explorer'),
  },
  {
    path: '/events-updates',
    name: 'events-updates',
    component: () => import('@/pages/events-updates'),
  },
  {
    path: '/activity',
    name: 'activity',
    component: () => import('@/pages/activity'),
  },
  {
    path: '/init',
    name: 'init',
    component: () => import('@/pages/init'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
