import type { FilterExample } from '@/shared/ui';

export const tenantFilterExamples: FilterExample[] = [
  {
    label: 'tenantId',
    options: [
      { value: '(tenantId,regex,test)', label: 'tenantId содержит "test"' },
      { value: '(tenantId,eq,tnt_default)', label: 'tenantId = tnt_default' },
    ],
  },
  {
    label: 'meta.*',
    options: [
      { value: '(meta.company,eq,MyCompany)', label: 'meta.company = MyCompany' },
      { value: '(meta.region,regex,europe)', label: 'meta.region содержит "europe"' },
    ],
  },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];
