import type { FilterExample } from '@/shared/ui';

export const packFilterExamples: FilterExample[] = [
  {
    label: 'meta.*',
    options: [
      { value: '(meta.category,eq,support)', label: 'meta.category = support' },
      { value: '(meta.region,regex,europe)', label: 'meta.region содержит "europe"' },
    ],
  },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];
