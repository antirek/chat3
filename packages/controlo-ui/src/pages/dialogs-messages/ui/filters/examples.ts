import type { FilterExample } from '@/shared/ui';

// Примеры фильтров для диалогов
export const dialogFilterExamples: FilterExample[] = [
  {
    label: 'Фильтры по meta',
    options: [
      { value: '(meta.channelType,eq,whatsapp)', label: 'meta. Тип канала = whatsapp' },
      { value: '(meta.channelType,ne,telegram)', label: 'meta. Тип канала ≠ telegram' },
      { value: '(meta.type,eq,internal)', label: 'meta. Тип диалога = internal' },
      { value: '(meta.type,ne,external)', label: 'meta. Тип диалога ≠ external' },
      { value: '(meta.securityLevel,eq,high)', label: 'meta. Уровень безопасности = high' },
      { value: '(meta.securityLevel,in,[high,medium])', label: 'meta. Уровень безопасности в [high,medium]' },
      { value: '(meta.maxParticipants,gt,50)', label: 'meta. Макс. участников > 50' },
      { value: '(meta.maxParticipants,gte,100)', label: 'meta. Макс. участников ≥ 100' },
      { value: '(meta.channelType,regex,^whats)', label: "meta. Тип канала начинается с 'whats'" },
      { value: '(meta.channelType,eq,whatsapp)&(meta.securityLevel,in,[high,medium])', label: 'meta. WhatsApp + высокий/средний уровень безопасности' },
      { value: '(meta.type,eq,internal)&(meta.maxParticipants,eq,50)', label: 'meta. Внутренний + 50 участников' },
      { value: '(meta.channelType,eq,telegram)&(meta.securityLevel,eq,high)', label: 'meta. Telegram + высокий уровень безопасности' },
    ],
  },
  {
    label: 'Фильтры по участникам',
    options: [
      { value: '(member,eq,carl)', label: '👤 Диалоги с Carl' },
      { value: '(member,eq,marta)', label: '👤 Диалоги с Marta' },
      { value: '(member,eq,sara)', label: '👤 Диалоги с Sara' },
      { value: '(member,eq,kirk)', label: '👤 Диалоги с Kirk' },
      { value: '(member,eq,john)', label: '👤 Диалоги с John' },
      { value: '(member,in,[carl,marta])', label: '👥 Диалоги с Carl или Marta' },
      { value: '(member,in,[sara,kirk,john])', label: '👥 Диалоги с Sara, Kirk или John' },
      { value: '(member,all,[carl,marta])', label: '👥 Диалоги с Carl И Marta (оба участника)' },
      { value: '(member,all,[carl,sara,kirk])', label: '👥 Диалоги с Carl, Sara И Kirk (все трое)' },
    ],
  },
  {
    label: 'По времени сообщения (message.createdAt)',
    options: [
      {
        value: '(message.createdAt,gte,1700000000)&(message.createdAt,lte,1700003600)',
        label: 'Сообщения в окне ~1 ч (unix-сек; смотрите Swagger tenant-api для ограничений)',
      },
    ],
  },
  {
    label: 'Комбинированные фильтры',
    options: [
      { value: '(member,eq,carl)&(meta.channelType,eq,whatsapp)', label: '👤 Carl + WhatsApp' },
      { value: '(member,eq,marta)&(meta.type,eq,internal)', label: '👤 Marta + Внутренний' },
      { value: '(member,eq,sara)&(meta.securityLevel,eq,high)', label: '👤 Sara + Высокий уровень безопасности' },
      { value: '(member,in,[carl,marta])&(meta.channelType,eq,telegram)', label: '👥 Carl/Marta + Telegram' },
      { value: '(member,eq,kirk)&(meta.maxParticipants,gte,50)', label: '👤 Kirk + ≥50 участников' },
      { value: '(member,eq,john)&(meta.channelType,eq,whatsapp)&(meta.securityLevel,eq,high)', label: '👤 John + WhatsApp + Высокий уровень' },
      { value: '(member,all,[carl,marta])&(meta.type,eq,internal)&(meta.maxParticipants,eq,50)', label: '👥 Carl+Marta + Внутренний + 50 участников' },
      { value: '(member,in,[sara,kirk])&(meta.channelType,in,[whatsapp,telegram])&(meta.securityLevel,in,[high,medium])', label: '👥 Sara/Kirk + WhatsApp/Telegram + Высокий/Средний уровень' },
    ],
  },
  {
    label: 'Фильтры по непрочитанным',
    options: [
      { value: '(member[carl].unreadCount,gte,4)&(meta.channelType,eq,whatsapp)', label: '📬 Carl ≥4 непрочитанных + WhatsApp' },
      { value: '(member[carl].unreadCount,eq,0)&(meta.type,eq,internal)', label: '📬 Carl 0 непрочитанных + Внутренний' },
      { value: '(member[carl].unreadCount,gte,2)&(meta.securityLevel,eq,high)', label: '📬 Carl ≥2 непрочитанных + Высокий уровень' },
    ],
  },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];

// Примеры сортировки для диалогов
export const dialogSortExamples: FilterExample[] = [
  { value: '(createdAt,desc)', label: '🕒 Создание диалога (новые сверху)' },
  { value: '(createdAt,asc)', label: '🕒 Создание диалога (старые сверху)' },
  { value: '(member[carl].unreadCount,desc)', label: '📬 Непрочитанные Carl (больше сверху)' },
  { value: '(member[carl].unreadCount,asc)', label: '📬 Непрочитанные Carl (меньше сверху)' },
  { value: '(member[marta].unreadCount,desc)', label: '📬 Непрочитанные Marta (больше сверху)' },
  { value: '(member[marta].unreadCount,asc)', label: '📬 Непрочитанные Marta (меньше сверху)' },
  { value: '(member[sara].unreadCount,desc)', label: '📬 Непрочитанные Sara (больше сверху)' },
  { value: '(member[sara].unreadCount,asc)', label: '📬 Непрочитанные Sara (меньше сверху)' },
  { value: '(member[kirk].unreadCount,desc)', label: '📬 Непрочитанные Kirk (больше сверху)' },
  { value: '(member[kirk].unreadCount,asc)', label: '📬 Непрочитанные Kirk (меньше сверху)' },
  { value: '(member[john].unreadCount,desc)', label: '📬 Непрочитанные John (больше сверху)' },
  { value: '(member[john].unreadCount,asc)', label: '📬 Непрочитанные John (меньше сверху)' },
  { value: 'custom', label: '✏️ Пользовательская сортировка' },
];

// Примеры фильтров для сообщений
export const messageFilterExamples: FilterExample[] = [
  { value: '(content,regex,встретимся)', label: '📝 Содержит "встретимся"' },
  { value: '(content,regex,спасибо)', label: '📝 Содержит "спасибо"' },
  { value: '(content,regex,привет)', label: '📝 Содержит "привет"' },
  { value: '(type,eq,internal.text)', label: '📝 Тип = internal.text' },
  { value: '(type,eq,system)', label: '📝 Тип = system' },
  { value: '(senderId,eq,carl)', label: '👤 Отправитель = carl' },
  { value: '(senderId,eq,sara)', label: '👤 Отправитель = sara' },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];
