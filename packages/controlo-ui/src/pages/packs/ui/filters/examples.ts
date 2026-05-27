import type { FilterExample } from '@/shared/ui';

const packMetaExistsExamples = [
  { value: '(meta.contactId,exists,true)', label: 'contactId: ключ есть' },
  { value: '(meta.contactId,exists,false)', label: 'contactId: ключа нет' },
  {
    value: '(meta.contactId,exists,true)&(meta.contactId,ne,"")&(meta.contactId,ne,null)',
    label: 'contactId: есть и не пустой'
  },
  { value: '(meta.contactId,eq,"")', label: 'contactId = "" (пустое значение, ключ есть)' }
];

export const packFilterExamples: FilterExample[] = [
  {
    label: 'meta: наличие ключа',
    options: packMetaExistsExamples
  },
  {
    label: 'meta: значение',
    options: [
      { value: '(meta.category,eq,support)', label: 'meta.category = support' },
      { value: '(meta.region,regex,europe)', label: 'meta.region содержит "europe"' },
      { value: '(meta.contactId,regex,^\\+7)', label: 'contactId начинается с +7' }
    ]
  },
  { value: 'custom', label: '✏️ Пользовательский фильтр' }
];

/** Примеры фильтра диалогов пака: meta диалогов и dialogId */
const dialogMetaExistsExamples = [
  { value: '(meta.contactId,exists,true)', label: 'contactId: ключ есть' },
  { value: '(meta.contactId,exists,false)', label: 'contactId: ключа нет' },
  {
    value: '(meta.contactId,exists,true)&(meta.contactId,ne,"")&(meta.contactId,ne,null)',
    label: 'contactId: есть и не пустой'
  }
];

export const packDialogsFilterExamples: FilterExample[] = [
  {
    label: 'meta диалогов: наличие ключа',
    options: dialogMetaExistsExamples
  },
  {
    label: 'meta диалогов: значение',
    options: [
      { value: '(meta.channel,eq,telegram)', label: 'meta.channel = telegram' },
      { value: '(meta.channel,eq,whatsapp)', label: 'meta.channel = whatsapp' },
      { value: '(meta.type,eq,support)', label: 'meta.type = support' }
    ]
  },
  {
    label: 'dialogId',
    options: [
      { value: '(dialogId,eq,dlg_xxxxxxxxxxxxxxxxxxxx)', label: 'конкретный dialogId' },
    ],
  },
  { value: 'custom', label: '✏️ Свой фильтр' },
];
