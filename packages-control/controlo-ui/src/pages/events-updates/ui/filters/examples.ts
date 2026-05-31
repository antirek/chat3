import type { FilterExample } from '@/shared/ui';

export const eventFilterExamples: FilterExample[] = [
  {
    label: 'По типу события',
    options: [
      { value: 'eventType=message.create', label: 'message.create' },
      { value: 'eventType=message.changed', label: 'message.changed' },
      { value: 'eventType=message.delete', label: 'message.delete' },
      { value: 'eventType=dialog.create', label: 'dialog.create' },
      { value: 'eventType=dialog.changed', label: 'dialog.changed' },
      { value: 'eventType=dialog.delete', label: 'dialog.delete' },
    ],
  },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];

export const updateFilterExamples: FilterExample[] = [
  {
    label: 'По updateType',
    options: [
      { value: 'updateType=update.message', label: 'update.message' },
      { value: 'updateType=update.dialog', label: 'update.dialog' },
      { value: 'updateType=update.user', label: 'update.user' },
    ],
  },
  {
    label: 'По sourceEventType',
    options: [
      { value: 'sourceEventType=message.create', label: 'message.create' },
      { value: 'sourceEventType=message.changed', label: 'message.changed' },
      { value: 'sourceEventType=dialog.create', label: 'dialog.create' },
    ],
  },
  {
    label: 'По полю',
    options: [
      { value: 'userId=', label: 'userId: (введите значение)' },
      { value: 'entityId=', label: 'entityId: (введите значение)' },
    ],
  },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];
