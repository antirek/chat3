import type { FilterExample } from '@/shared/ui';

export const messageFilterExamples: FilterExample[] = [
  {
    label: 'По содержимому',
    options: [
      { value: '(content,regex,встретимся)', label: '📝 Содержит "встретимся"' },
      { value: '(content,regex,спасибо)', label: '📝 Содержит "спасибо"' },
      { value: '(content,regex,привет)', label: '📝 Содержит "привет"' },
      { value: '(content,regex,хорошо)', label: '📝 Содержит "хорошо"' },
      { value: '(content,regex,интересно)', label: '📝 Содержит "интересно"' },
      { value: '(content,regex,отлично)', label: '📝 Содержит "отлично"' },
    ],
  },
  {
    label: 'По типу',
    options: [
      { value: '(type,eq,internal.text)', label: '📝 Тип = internal.text' },
      { value: '(type,eq,system)', label: '📝 Тип = system' },
      { value: '(type,in,[text,system])', label: '📝 Тип в [text,system]' },
    ],
  },
  {
    label: 'По отправителю',
    options: [
      { value: '(senderId,eq,carl)', label: '👤 Отправитель = carl' },
      { value: '(senderId,eq,sara)', label: '👤 Отправитель = sara' },
      { value: '(senderId,in,[carl,marta])', label: '👥 Отправитель в [carl,marta]' },
    ],
  },
  {
    label: 'По диалогу',
    options: [
      { value: '(dialogId,eq,dlg_nfftyjrk53nn5w4bc94n)', label: '💬 Диалог = Общий чат' },
      { value: '(dialogId,eq,dlg_xndr7w5fhvazpvi8a35p)', label: '💬 Диалог = Проектные обсуждения' },
      { value: '(dialogId,eq,dlg_1qdl3ymr68r2ebve4tqt)', label: '💬 Диалог = Техподдержка' },
      { value: '(dialogId,in,[dlg_nfftyjrk53nn5w4bc94n,dlg_xndr7w5fhvazpvi8a35p])', label: '💬 Диалог в [Общий чат,Проектные обсуждения]' },
    ],
  },
  {
    label: 'По каналу (meta)',
    options: [
      { value: '(meta.channelType,eq,whatsapp)', label: '📱 WhatsApp сообщения' },
      { value: '(meta.channelType,eq,telegram)', label: '📱 Telegram сообщения' },
      { value: '(meta.channelId,eq,W0000)', label: '📱 Канал W0000' },
      { value: '(meta.channelId,eq,TG0000)', label: '📱 Канал TG0000' },
      { value: '(meta.channelType,in,[whatsapp,telegram])', label: '📱 WhatsApp или Telegram' },
    ],
  },
  {
    label: 'По дате',
    options: [
      { value: '(createdAt,gte,2025-10-24)', label: '📅 Создано ≥ 24.10.2025' },
      { value: '(createdAt,gte,2025-10-22)', label: '📅 Создано ≥ 22.10.2025' },
      { value: '(createdAt,lt,2025-10-21)', label: '📅 Создано < 21.10.2025' },
    ],
  },
  {
    label: 'Комбинированные',
    options: [
      { value: '(content,regex,встретимся)&(type,eq,system)', label: '📝 "встретимся" + system' },
      { value: '(senderId,eq,carl)&(type,eq,system)', label: '👤 Carl + system' },
      { value: '(content,regex,спасибо)&(createdAt,gte,2025-10-24)', label: '📝 "спасибо" + ≥24.10' },
      { value: '(senderId,in,[carl,sara])&(type,eq,internal.text)&(content,regex,привет)', label: '👥 Carl/Sara + internal.text + "привет"' },
      { value: '(dialogId,eq,dlg_nfftyjrk53nn5w4bc94n)&(senderId,eq,carl)', label: '💬 Общий чат + Carl' },
      { value: '(dialogId,eq,dlg_xndr7w5fhvazpvi8a35p)&(type,eq,internal.text)', label: '💬 Проектные обсуждения + internal.text' },
      { value: '(dialogId,in,[dlg_nfftyjrk53nn5w4bc94n,dlg_xndr7w5fhvazpvi8a35p])&(senderId,eq,marta)', label: '💬 Общий чат/Проектные + Marta' },
      { value: '(meta.channelType,eq,whatsapp)&(senderId,eq,carl)', label: '📱 WhatsApp + Carl' },
      { value: '(meta.channelType,eq,telegram)&(type,eq,internal.text)', label: '📱 Telegram + internal.text' },
      { value: '(meta.channelId,eq,W0000)&(content,regex,привет)', label: '📱 W0000 + "привет"' },
      { value: '(meta.channelType,in,[whatsapp,telegram])&(senderId,in,[carl,sara])', label: '📱 WhatsApp/Telegram + Carl/Sara' },
      { value: '(dialogId,eq,dlg_nfftyjrk53nn5w4bc94n)&(meta.channelType,eq,telegram)', label: '💬 Общий чат + Telegram' },
      { value: '(meta.channelId,eq,TG0000)&(type,eq,system)', label: '📱 TG0000 + system' },
      { value: '(dialogId,in,[dlg_nfftyjrk53nn5w4bc94n,dlg_xndr7w5fhvazpvi8a35p])&(senderId,in,[carl,marta])&(meta.channelType,eq,telegram)', label: '💬 2 диалога + 2 отправителя + Telegram' },
    ],
  },
  { value: 'custom', label: '✏️ Пользовательский фильтр' },
];
