import type { FilterExample } from '@/shared/ui';

// Примеры фильтров для пользователей
export const userFilterExamples: FilterExample[] = [
  {
    label: 'Поле userId',
    options: [
      { value: '(userId,regex,carl)', label: 'userId содержит "carl"' },
      { value: '(userId,regex,bot)', label: 'userId содержит "bot"' },
      { value: '(userId,eq,system_bot)', label: 'userId = system_bot' },
    ],
  },
  {
    label: 'Поле name',
    options: [
      { value: '(name,regex,Alice)', label: 'Имя содержит "Alice"' },
      { value: '(name,regex,Marta)', label: 'Имя содержит "Marta"' },
    ],
  },
  {
    label: 'Мета-теги (meta.*)',
    options: [
      { value: '(meta.role,eq,manager)', label: 'meta.role = manager' },
      { value: '(meta.region,regex,europe)', label: 'meta.region содержит "europe"' },
    ],
  },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];

// Примеры фильтров для диалогов
export const dialogFilterExamples: FilterExample[] = [
  {
    label: 'Фильтры по участникам',
    options: [
      { value: '(member,in,[carl])', label: '👥 С участником: carl' },
      { value: '(member,in,[marta])', label: '👥 С участником: marta' },
      { value: '(member,in,[alice])', label: '👥 С участником: alice' },
      { value: '(member,in,[bob])', label: '👥 С участником: bob' },
      { value: '(member,in,[sara])', label: '👥 С участником: sara' },
      { value: '(member,in,[kirk])', label: '👥 С участником: kirk' },
      { value: '(member,in,[john])', label: '👥 С участником: john' },
      { value: '(member,in,[eve])', label: '👥 С участником: eve' },
      { value: '(member,in,[carl,marta])', label: '👥 С участниками: carl или marta' },
      { value: '(member,in,[alice,bob])', label: '👥 С участниками: alice или bob' },
      { value: '(member,in,[carl,marta,alice])', label: '👥 С участниками: carl, marta или alice' },
      { value: '(member,in,[alice,bob,eve])', label: '👥 С участниками: alice, bob или eve' },
      { value: '(member,all,[carl,marta])', label: '👥 Со всеми участниками: carl и marta' },
      { value: '(member,all,[alice,bob])', label: '👥 Со всеми участниками: alice и bob' },
      { value: '(member,all,[carl,marta,alice])', label: '👥 Со всеми участниками: carl, marta и alice' },
      { value: '(member,ne,carl)', label: '👥 БЕЗ участника: carl' },
      { value: '(member,ne,marta)', label: '👥 БЕЗ участника: marta' },
      { value: '(member,nin,[carl,marta])', label: '👥 БЕЗ участников: carl и marta' },
    ],
  },
  {
    label: 'Фильтры по meta',
    options: [
      { value: '(meta.channelType,eq,whatsapp)', label: 'meta. Тип канала = whatsapp' },
      { value: '(meta.channelType,eq,telegram)', label: 'meta. Тип канала = telegram' },
      { value: '(meta.type,eq,internal)', label: 'meta. Тип диалога = internal' },
      { value: '(meta.type,eq,external)', label: 'meta. Тип диалога = external' },
      { value: '(meta.securityLevel,eq,high)', label: 'meta. Уровень безопасности = high' },
      { value: '(meta.securityLevel,in,[high,medium])', label: 'meta. Уровень безопасности в [high,medium]' },
      { value: '(meta.maxParticipants,gte,50)', label: 'meta. Макс. участников ≥ 50' },
      { value: '(meta.maxParticipants,eq,50)', label: 'meta. Макс. участников = 50' },
      { value: '(meta.channelType,regex,^whats)', label: "meta. Тип канала начинается с 'whats'" },
      { value: '(meta.channelType,eq,whatsapp)&(meta.securityLevel,in,[high,medium])', label: 'meta. WhatsApp + высокий/средний уровень безопасности' },
      { value: '(meta.type,eq,internal)&(meta.maxParticipants,eq,50)', label: 'meta. Внутренний + 50 участников' },
      { value: '(meta.channelType,eq,telegram)&(meta.securityLevel,eq,high)', label: 'meta. Telegram + высокий уровень безопасности' },
    ],
  },
  {
    label: 'Фильтры по топикам',
    options: [
      { value: '(topic.topicId,eq,topic_xxxxxxxxxxxxxxxxxxxx)', label: '📌 По topicId (замените на реальный)' },
      { value: '(topic.topicId,ne,null)', label: '📌 Диалоги с любыми топиками' },
      { value: '(topic.topicId,in,[topic_xxx1,topic_xxx2])', label: '📌 С любым из указанных топиков (замените на реальные)' },
      { value: '(topic.topicId,nin,[topic_xxx1,topic_xxx2])', label: '📌 БЕЗ указанных топиков (замените на реальные)' },
      { value: '(topic.meta.category,eq,general)', label: '📌 Топики с meta.category = general' },
      { value: '(topic.meta.category,eq,support)', label: '📌 Топики с meta.category = support' },
      { value: '(topic.meta.category,in,[general,support])', label: '📌 Топики с meta.category в [general,support]' },
      { value: '(topic.meta.category,ne,archived)', label: '📌 Топики с meta.category ≠ archived' },
      { value: '(topic.meta.priority,eq,high)', label: '📌 Топики с meta.priority = high' },
      { value: '(topic.meta.priority,in,[high,urgent])', label: '📌 Топики с meta.priority в [high,urgent]' },
      { value: '(topic.meta.status,eq,active)', label: '📌 Топики с meta.status = active' },
      { value: '(topic.meta.status,ne,closed)', label: '📌 Топики с meta.status ≠ closed' },
      { value: '(topic.meta.assignedTo,exists,true)', label: '📌 Топики с назначенным пользователем' },
      { value: '(topic.meta.assignedTo,exists,false)', label: '📌 Топики БЕЗ назначенного пользователя' },
      { value: '(topic.topicCount,gt,0)', label: '📌 Диалоги с топиками (topicCount > 0)' },
      { value: '(topic.topicCount,eq,0)', label: '📌 Диалоги без топиков (topicCount = 0)' },
      { value: '(topic.topicCount,gte,3)', label: '📌 Диалоги с 3+ топиками' },
      { value: '(topic.topicCount,lte,5)', label: '📌 Диалоги с ≤5 топиками' },
      { value: '(topic.topicCount,in,[1,2,3])', label: '📌 Диалоги с 1, 2 или 3 топиками' },
    ],
  },
  {
    label: 'Комбинированные фильтры',
    options: [
      { value: '(unreadCount,gte,4)&(meta.channelType,eq,whatsapp)', label: '📬 ≥4 непрочитанных + WhatsApp' },
      { value: '(unreadCount,eq,0)&(meta.type,eq,internal)', label: '📬 0 непрочитанных + Внутренний' },
      { value: '(unreadCount,gte,2)&(meta.securityLevel,eq,high)', label: '📬 ≥2 непрочитанных + Высокий уровень' },
      { value: '(unreadCount,gt,0)&(meta.channelType,eq,telegram)', label: '📬 >0 непрочитанных + Telegram' },
      { value: '(unreadCount,gte,1)&(meta.maxParticipants,eq,50)', label: '📬 ≥1 непрочитанных + 50 участников' },
      { value: '(unreadCount,eq,0)&(meta.type,eq,external)', label: '📬 0 непрочитанных + Внешний' },
      { value: '(unreadCount,gte,3)&(meta.channelType,eq,whatsapp)', label: '📬 ≥3 непрочитанных + WhatsApp' },
      { value: '(unreadCount,gt,0)&(meta.channelType,in,[whatsapp,telegram])&(meta.securityLevel,eq,high)', label: '📬 >0 непрочитанных + WhatsApp/Telegram + Высокий уровень' },
      { value: '(member,in,[carl])&(meta.channelType,eq,whatsapp)', label: '👥 С carl + WhatsApp' },
      { value: '(member,in,[marta])&(unreadCount,gt,0)', label: '👥 С marta + есть непрочитанные' },
      { value: '(member,in,[alice])&(meta.channelType,eq,telegram)', label: '👥 С alice + Telegram' },
      { value: '(member,in,[carl,marta])&(unreadCount,eq,0)', label: '👥 С carl или marta + нет непрочитанных' },
      { value: '(member,all,[carl,marta])&(meta.type,eq,internal)', label: '👥 Со всеми: carl и marta + внутренний' },
      { value: '(member,in,[alice,bob])&(meta.channelType,eq,whatsapp)', label: '👥 С alice или bob + WhatsApp' },
      { value: '(member,in,[sara])&(unreadCount,gte,1)', label: '👥 С sara + ≥1 непрочитанных' },
      { value: '(topic.topicId,ne,null)&(topic.meta.category,eq,support)', label: '📌 С топиками + category = support' },
      { value: '(topic.topicId,ne,null)&(topic.meta.status,ne,archived)', label: '📌 С топиками + status ≠ archived' },
      { value: '(topic.meta.priority,eq,high)&(topic.meta.status,ne,closed)', label: '📌 priority = high + status ≠ closed' },
      { value: '(topic.topicId,ne,null)&(topic.meta.priority,in,[high,urgent])&(topic.meta.status,ne,archived)', label: '📌 С топиками + priority в [high,urgent] + не архивные' },
      { value: '(topic.topicCount,gte,3)&(topic.meta.category,eq,support)', label: '📌 ≥3 топиков + category = support' },
      { value: '(topic.topicCount,in,[1,2,3])&(topic.meta.priority,eq,high)', label: '📌 1-3 топика + priority = high' },
      { value: '(member,in,[carl])&(topic.topicCount,gt,0)&(topic.meta.status,ne,archived)', label: '👥 С carl + есть топики + не архивные' },
      { value: '(topic.topicId,ne,null)&(unreadCount,gt,0)', label: '📌 С топиками + есть непрочитанные' },
      { value: '(topic.topicCount,gte,2)&(meta.channelType,eq,whatsapp)', label: '📌 ≥2 топиков + WhatsApp' },
    ],
  },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];

// Примеры фильтров для сообщений
export const messageFilterExamples: FilterExample[] = [
  { value: '(content,regex,встретимся)', label: '📝 Содержит "встретимся"' },
  { value: '(content,regex,спасибо)', label: '📝 Содержит "спасибо"' },
  { value: '(content,regex,привет)', label: '📝 Содержит "привет"' },
  { value: '(content,regex,хорошо)', label: '📝 Содержит "хорошо"' },
  { value: '(content,regex,интересно)', label: '📝 Содержит "интересно"' },
  { value: '(content,regex,отлично)', label: '📝 Содержит "отлично"' },
  { value: '(type,eq,internal.text)', label: '📝 Тип = internal.text' },
  { value: '(type,eq,system)', label: '📝 Тип = system' },
  { value: '(type,in,[text,system])', label: '📝 Тип в [text,system]' },
  { value: '(senderId,eq,carl)', label: '👤 Отправитель = carl' },
  { value: '(senderId,eq,sara)', label: '👤 Отправитель = sara' },
  { value: '(senderId,in,[carl,marta])', label: '👥 Отправитель в [carl,marta]' },
  { value: '(topic.topicId,eq,topic_xxxxxxxxxxxxxxxxxxxx)', label: '📌 По topicId (замените на реальный)' },
  { value: '(topic.topicId,eq,null)', label: '📌 Без топика (topicId = null)' },
  { value: '(createdAt,gte,2025-10-24)', label: '📅 Создано ≥ 24.10.2025' },
  { value: '(createdAt,gte,2025-10-22)', label: '📅 Создано ≥ 22.10.2025' },
  { value: '(createdAt,lt,2025-10-21)', label: '📅 Создано < 21.10.2025' },
  { value: '(content,regex,встретимся)&(type,eq,system)', label: '📝 "встретимся" + system' },
  { value: '(senderId,eq,carl)&(type,eq,system)', label: '👤 Carl + system' },
  { value: '(content,regex,спасибо)&(createdAt,gte,2025-10-24)', label: '📝 "спасибо" + ≥24.10' },
  { value: '(senderId,in,[carl,sara])&(type,eq,internal.text)&(content,regex,привет)', label: '👥 Carl/Sara + internal.text + "привет"' },
  { value: '(topic.topicId,eq,topic_xxxxxxxxxxxxxxxxxxxx)&(type,eq,internal.text)', label: '📌 По topicId + internal.text' },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];

// Примеры фильтров для участников
export const memberFilterExamples: FilterExample[] = [
  {
    label: 'userId',
    options: [
      { value: '(userId,regex,carl)', label: 'userId содержит "carl"' },
      { value: '(userId,eq,alice)', label: 'userId = alice' },
    ],
  },
  {
    label: 'Активность и счётчики',
    options: [
      { value: '(isActive,eq,true)', label: 'Только активные' },
      { value: '(unreadCount,gt,0)', label: 'Непрочитанные > 0' },
    ],
  },
  {
    label: 'Мета-теги (meta.*)',
    options: [
      { value: '(meta.role,eq,agent)', label: 'meta.role = agent' },
      { value: '(meta.shift,eq,day)', label: 'meta.shift = day' },
    ],
  },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];

// Примеры фильтров для паков пользователя (GET /api/users/:userId/packs)
export const packFilterExamples: FilterExample[] = [
  {
    label: 'Непрочитанные',
    options: [
      { value: '(unreadCount,gt,0)', label: 'С непрочитанными' },
      { value: '(unreadCount,eq,0)', label: 'Без непрочитанных' },
      { value: '(unreadCount,gte,1)', label: '≥ 1 непрочитанное' },
    ],
  },
  {
    label: 'Мета пака (meta.*)',
    options: [
      { value: '(meta.name,eq,support)', label: 'meta.name = support' },
      { value: '(meta.category,eq,general)', label: 'meta.category = general' },
    ],
  },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];
