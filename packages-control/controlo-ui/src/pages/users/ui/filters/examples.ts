import type { FilterExample } from '@/shared/ui';

export const userFilterExamples: FilterExample[] = [
  {
    label: 'userId',
    options: [
      { value: '(userId,regex,bot)', label: 'userId содержит "bot"' },
      { value: '(userId,eq,system_bot)', label: 'userId = system_bot' },
    ],
  },
  {
    label: 'type',
    options: [
      { value: '(type,in,[user,bot])', label: 'type в списке [user, bot]' },
      { value: '(type,eq,user)', label: 'type = user' },
      { value: '(type,eq,bot)', label: 'type = bot' },
      { value: '(type,eq,contact)', label: 'type = contact' },
    ],
  },
  {
    label: 'meta.*',
    options: [
      { value: '(meta.role,eq,manager)', label: 'meta.role = manager' },
      { value: '(meta.region,regex,europe)', label: 'meta.region содержит "europe"' },
    ],
  },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];
