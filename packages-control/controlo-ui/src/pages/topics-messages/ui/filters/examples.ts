import type { FilterExample } from '@/shared/ui';

export const topicFilterExamples: FilterExample[] = [
  {
    label: 'По topicId / dialogId',
    options: [
      { value: '(topicId,eq,topic_xxxxxxxxxxxxxxxxxxxx)', label: 'topicId = конкретный' },
      { value: '(dialogId,eq,dlg_xxxxxxxxxxxxxxxxxxxx)', label: 'dialogId = конкретный' },
      { value: '(dialogId,in,[dlg_abc,dlg_def])', label: 'dialogId в списке' },
    ],
  },
  {
    label: 'По meta',
    options: [
      { value: '(meta.category,eq,support)', label: 'meta.category = support' },
      { value: '(meta.priority,eq,high)', label: 'meta.priority = high' },
      { value: '(meta.category,in,[support,general])', label: 'meta.category в [support,general]' },
    ],
  },
  {
    label: 'С ИЛИ (OR)',
    options: [
      { value: '(meta.name,eq,personal)|(meta.name,eq,work)', label: 'meta.name = personal или work' },
      { value: '(meta.category,eq,support)|(meta.category,eq,general)', label: 'meta.category = support или general' },
      { value: '((meta.category,eq,support)&(meta.priority,eq,high))|(meta.name,eq,urgent)', label: '(category=support и priority=high) или name=urgent' },
    ],
  },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];

export const topicSortExamples: FilterExample[] = [
  { value: '(createdAt,desc)', label: '🕒 Создание (новые сверху)' },
  { value: '(createdAt,asc)', label: '🕒 Создание (старые сверху)' },
  { value: '(dialogId,asc)', label: 'По dialogId (A–Z)' },
  { value: '(dialogId,desc)', label: 'По dialogId (Z–A)' },
  { value: 'custom', label: '✏️ Пользовательская сортировка' },
];
