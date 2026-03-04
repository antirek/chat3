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

/** Примеры фильтра диалогов пака: meta диалогов и dialogId */
export const packDialogsFilterExamples: FilterExample[] = [
  {
    label: 'meta диалогов',
    options: [
      { value: '(meta.channel,eq,telegram)', label: 'meta.channel = telegram' },
      { value: '(meta.channel,eq,whatsapp)', label: 'meta.channel = whatsapp' },
      { value: '(meta.type,eq,support)', label: 'meta.type = support' },
    ],
  },
  {
    label: 'dialogId',
    options: [
      { value: '(dialogId,eq,dlg_xxxxxxxxxxxxxxxxxxxx)', label: 'конкретный dialogId' },
    ],
  },
  { value: 'custom', label: '✏️ Свой фильтр' },
];
