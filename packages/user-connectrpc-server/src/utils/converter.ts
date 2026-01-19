/**
 * Утилиты для преобразования данных из tenant-api в ConnectRPC формат
 * (адаптировано из gRPC версии)
 */
import { Struct } from '@bufbuild/protobuf';
import { Message, MessageStatus, SenderInfo, DialogMember, MemberState } from '../generated/chat3_user_pb.js';

/**
 * Преобразует объект в google.protobuf.Struct
 * Protobuf-ES v1 требует использования класса Struct
 */
export function convertToStruct(obj: any): Struct | undefined {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }
  // Protobuf-ES v1: создаем Struct из JSON объекта
  return Struct.fromJson(obj);
}

/**
 * Преобразует диалог из tenant-api в ConnectRPC формат
 * Protobuf-ES v1 требует создания экземпляров классов для правильной сериализации
 */
export function convertToConnectDialog(dialog: any): any {
  // Убеждаемся, что все timestamp поля имеют тип number
  const createdAt = typeof dialog.createdAt === 'bigint' 
    ? Number(dialog.createdAt)
    : (typeof dialog.createdAt === 'number' ? dialog.createdAt : Number(dialog.createdAt || 0));
  const updatedAt = typeof dialog.updatedAt === 'bigint' 
    ? Number(dialog.updatedAt)
    : (typeof dialog.updatedAt === 'number' ? dialog.updatedAt : Number(dialog.updatedAt || 0));

  // Создаем MemberState объект через конструктор класса
  const memberState = dialog.member?.state ? (() => {
    const lastSeenAt = typeof dialog.member.state.lastSeenAt === 'bigint' 
      ? Number(dialog.member.state.lastSeenAt)
      : (typeof dialog.member.state.lastSeenAt === 'number' ? dialog.member.state.lastSeenAt : Number(dialog.member.state.lastSeenAt || 0));
    const lastMessageAt = typeof dialog.member.state.lastMessageAt === 'bigint' 
      ? Number(dialog.member.state.lastMessageAt)
      : (typeof dialog.member.state.lastMessageAt === 'number' ? dialog.member.state.lastMessageAt : Number(dialog.member.state.lastMessageAt || 0));
    
    return new MemberState({
      unreadCount: dialog.member.state.unreadCount || 0,
      lastSeenAt,
      lastMessageAt,
      isActive: dialog.member.state.isActive !== false
    });
  })() : undefined;

  // Создаем DialogMember объект через конструктор класса
  const member = dialog.member
    ? new DialogMember({
        userId: dialog.member.userId || '',
        meta: convertToStruct(dialog.member.meta),
        state: memberState
      })
    : undefined;

  // Временно убираем lastMessage, чтобы проверить, работает ли загрузка диалогов без него
  // Проблема с сериализацией lastMessage в JSON требует дальнейшей отладки
  const lastMessage = dialog.lastMessage ? convertToConnectMessage(dialog.lastMessage) : undefined;
  
  // Проверяем тип createdAt в lastMessage перед возвратом
  if (lastMessage && typeof (lastMessage as any).createdAt !== 'number') {
    console.error('[convertToConnectDialog] lastMessage.createdAt is not a number:', typeof (lastMessage as any).createdAt, (lastMessage as any).createdAt);
  }
  
  // Возвращаем простой объект (будет преобразован в Dialog в handler)
  return {
    dialogId: dialog.dialogId || '',
    tenantId: dialog.tenantId || '',
    name: dialog.name || '',
    createdBy: dialog.createdBy || '',
    createdAt: createdAt,
    updatedAt: updatedAt,
    meta: convertToStruct(dialog.meta),
    member,
    // Временно убираем lastMessage для проверки проблемы с сериализацией
    // lastMessage: lastMessage
  };
}

/**
 * Преобразует сообщение из tenant-api в ConnectRPC формат
 * Protobuf-ES v1 требует создания экземпляров классов для правильной сериализации
 */
export function convertToConnectMessage(message: any): Message {
  // Убеждаемся, что createdAt имеет тип number, а не bigint или другой тип
  const createdAt = typeof message.createdAt === 'bigint' 
    ? Number(message.createdAt)
    : (typeof message.createdAt === 'number' ? message.createdAt : Number(message.createdAt || 0));

  // Создаем MessageStatus объекты через конструкторы классов
  const statuses = (message.statuses || []).map((status: any) => {
    const statusCreatedAt = typeof status.createdAt === 'bigint' 
      ? Number(status.createdAt)
      : (typeof status.createdAt === 'number' ? status.createdAt : Number(status.createdAt || 0));
    const statusReadAt = typeof status.readAt === 'bigint' 
      ? Number(status.readAt)
      : (typeof status.readAt === 'number' ? status.readAt : Number(status.readAt || 0));
    
    return new MessageStatus({
      userId: status.userId || '',
      status: status.status || '',
      readAt: statusReadAt,
      createdAt: statusCreatedAt
    });
  });

  // Создаем SenderInfo объект через конструктор класса
  const senderInfo = message.senderInfo ? (() => {
    const senderCreatedAt = typeof message.senderInfo.createdAt === 'bigint' 
      ? Number(message.senderInfo.createdAt)
      : (typeof message.senderInfo.createdAt === 'number' ? message.senderInfo.createdAt : Number(message.senderInfo.createdAt || 0));
    
    return new SenderInfo({
      userId: message.senderInfo.userId || '',
      name: message.senderInfo.name || '',
      createdAt: senderCreatedAt,
      meta: convertToStruct(message.senderInfo.meta)
    });
  })() : undefined;

  // Создаем Message объект через конструктор класса
  return new Message({
    messageId: message.messageId || '',
    dialogId: message.dialogId || '',
    senderId: message.senderId || '',
    type: message.type || 'internal.text',
    content: message.content || '',
    meta: convertToStruct(message.meta),
    statuses,
    reactionSet: convertToStruct(message.reactionSet),
    senderInfo,
    createdAt: createdAt,
    topicId: message.topicId || '',
    topic: message.topic ? convertToStruct(message.topic) : undefined
  });
}

/**
 * Преобразует update из RabbitMQ в ConnectRPC формат
 */
export function convertToConnectUpdate(update: any): any {
  // Поддерживаем оба формата: из MongoDB (eventType) и простой объект (event_type)
  const eventType = update.eventType || update.event_type || '';
  const tenantId = update.tenantId || update.tenant_id || '';
  const userId = update.userId || update.user_id || '';
  const entityId = update.entityId?.toString() || update.entity_id?.toString() || '';
  const updateId = update._id?.toString() || update.update_id || '';
  const createdAt = update.createdAt || update.created_at || 0;
  const data = update.data || {};
  
  const result: any = {
    updateId: updateId || '',
    tenantId: tenantId || '',
    userId: userId || '',
    entityId: entityId || '',
    eventType: eventType || '',
    createdAt: createdAt || 0
  };
  
  // Преобразуем data в Struct
  const dataStruct = convertToStruct(data);
  if (dataStruct !== undefined) {
    result.data = dataStruct;
  }
  
  // Логируем для отладки
  if (eventType === 'connection.established') {
    console.log(`[converter] Converting connection update: eventType=${eventType}, connId=${data.conn_id || 'N/A'}, result.eventType=${result.eventType}`);
  }
  
  return result;
}
