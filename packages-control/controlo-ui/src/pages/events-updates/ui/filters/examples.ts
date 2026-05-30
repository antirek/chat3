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
    label: 'По типу события',
    options: [
      { value: 'eventType=message.create', label: 'eventType: message.create' },
      { value: 'eventType=message.changed', label: 'eventType: message.changed' },
      { value: 'eventType=dialog.create', label: 'eventType: dialog.create' },
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
