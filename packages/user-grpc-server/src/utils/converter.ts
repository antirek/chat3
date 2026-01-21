/**
 * Утилиты для преобразования данных из tenant-api в gRPC формат
 */

/**
 * Преобразует объект в google.protobuf.Struct
 * @grpc/proto-loader автоматически преобразует обычные объекты в Struct
 */
export function convertToStruct(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }
  // @grpc/proto-loader автоматически преобразует объекты в Struct при отправке
  return obj;
}

/**
 * Преобразует диалог из tenant-api в gRPC формат
 */
export function convertToGrpcDialog(dialog: any): any {
  return {
    dialog_id: dialog.dialogId,
    tenant_id: dialog.tenantId,
    name: dialog.name || '',
    created_by: dialog.createdBy || '',
    created_at: dialog.createdAt || 0,
    updated_at: dialog.updatedAt || 0,
    meta: convertToStruct(dialog.meta),
    member: dialog.member ? {
      user_id: dialog.member.userId,
      meta: convertToStruct(dialog.member.meta),
      state: dialog.member.state ? {
        unread_count: dialog.member.state.unreadCount || 0,
        last_seen_at: dialog.member.state.lastSeenAt || 0,
        last_message_at: dialog.member.state.lastMessageAt || 0,
        is_active: dialog.member.state.isActive !== false
      } : undefined
    } : undefined,
    last_message: dialog.lastMessage ? convertToGrpcMessage(dialog.lastMessage) : undefined
  };
}

/**
 * Преобразует сообщение из tenant-api в gRPC формат
 */
export function convertToGrpcMessage(message: any): any {
  return {
    message_id: message.messageId,
    dialog_id: message.dialogId,
    sender_id: message.senderId || '',
    type: message.type || 'internal.text',
    content: message.content || '',
    meta: convertToStruct(message.meta),
    statuses: (message.statuses || []).map((status: any) => ({
      user_id: status.userId,
      status: status.status,
      read_at: status.readAt || 0,
      created_at: status.createdAt || 0
    })),
    reaction_set: convertToStruct(message.reactionSet),
    sender_info: message.senderInfo ? {
      user_id: message.senderInfo.userId,
      name: message.senderInfo.name || '',
      created_at: message.senderInfo.createdAt || 0,
      meta: convertToStruct(message.senderInfo.meta)
    } : undefined,
    created_at: message.createdAt || 0,
    topic_id: message.topicId || '',
    topic: message.topic ? convertToStruct(message.topic) : undefined
  };
}

/**
 * Преобразует статус сообщения из tenant-api в gRPC формат
 */
export function convertToGrpcMessageStatus(status: any): any {
  return {
    user_id: status.userId || '',
    status: status.status || '',
    read_at: status.readAt || 0,
    created_at: status.createdAt || 0
  };
}

/**
 * Преобразует update из RabbitMQ в gRPC формат
 */
export function convertToGrpcUpdate(update: any): any {
  // Поддерживаем оба формата: из MongoDB (eventType) и простой объект (event_type)
  const eventType = update.eventType || update.event_type || '';
  const tenantId = update.tenantId || update.tenant_id || '';
  const userId = update.userId || update.user_id || '';
  const entityId = update.entityId?.toString() || update.entity_id?.toString() || '';
  const updateId = update._id?.toString() || update.update_id || '';
  const createdAt = update.createdAt || update.created_at || 0;
  const data = update.data || {};
  
  // proto-loader с keepCase: true требует snake_case для полей
  const result: any = {
    update_id: updateId || '',
    tenant_id: tenantId || '',
    user_id: userId || '',
    entity_id: entityId || '',
    event_type: eventType || '',
    created_at: createdAt || 0
  };
  
  // Преобразуем data в Struct (proto-loader автоматически преобразует объекты)
  const dataStruct = convertToStruct(data);
  if (dataStruct !== undefined) {
    result.data = dataStruct;
  }
  
  return result;
  
  // Логируем для отладки
  if (eventType === 'connection.established') {
    console.log(`[converter] Converting connection update: eventType=${eventType}, connId=${data.conn_id || 'N/A'}, result.event_type=${result.event_type}`);
  }
  
  return result;
}
