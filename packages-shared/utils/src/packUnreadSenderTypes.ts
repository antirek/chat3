/**
 * Фиксированный список типов отправителей для разбивки непрочитанных по пакам/диалогам.
 * Используется в API и в UserPackStatsUpdate: всегда отдаём по одному элементу на каждый тип (countUnread, в т.ч. 0).
 */
export const PACK_UNREAD_SENDER_TYPES = ['user', 'contact', 'bot'] as const;

export type PackUnreadSenderType = (typeof PACK_UNREAD_SENDER_TYPES)[number];

const SET = new Set<string>(PACK_UNREAD_SENDER_TYPES);

/**
 * Нормализует тип отправителя к одному из PACK_UNREAD_SENDER_TYPES (иначе 'user').
 */
export function normalizeSenderType(type: string | null | undefined): PackUnreadSenderType {
  if (type && SET.has(type)) return type as PackUnreadSenderType;
  return 'user';
}
