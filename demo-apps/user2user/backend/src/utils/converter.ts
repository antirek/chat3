/**
 * Утилиты для конвертации данных между gRPC и JSON форматами
 */

/**
 * Конвертирует google.protobuf.Struct в обычный JavaScript объект
 */
export function structToJson(struct: any): any {
  if (!struct || !struct.fields) {
    return {};
  }

  const result: any = {};
  for (const [key, value] of Object.entries(struct.fields)) {
    const structValue = value as any;
    if (structValue.stringValue !== undefined) {
      result[key] = structValue.stringValue;
    } else if (structValue.numberValue !== undefined) {
      result[key] = structValue.numberValue;
    } else if (structValue.boolValue !== undefined) {
      result[key] = structValue.boolValue;
    } else if (structValue.listValue !== undefined) {
      result[key] = structValue.listValue.values?.map((v: any) => structToJson(v)) || [];
    } else if (structValue.structValue !== undefined) {
      result[key] = structToJson(structValue.structValue);
    }
  }
  return result;
}

/**
 * Конвертирует обычный JavaScript объект в google.protobuf.Struct
 */
export function jsonToStruct(obj: any): any {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return undefined;
  }

  const fields: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { numberValue: value };
    } else if (typeof value === 'boolean') {
      fields[key] = { boolValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        listValue: {
          values: value.map((v) => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return { numberValue: v };
            if (typeof v === 'boolean') return { boolValue: v };
            if (typeof v === 'object') return { structValue: jsonToStruct(v) };
            return { stringValue: String(v) };
          }),
        },
      };
    } else if (typeof value === 'object' && value !== null) {
      fields[key] = { structValue: jsonToStruct(value) };
    }
  }
  return { fields };
}

/**
 * Конвертирует timestamp (микросекунды) в JavaScript Date
 */
export function timestampToDate(timestamp: number): Date {
  return new Date(timestamp);
}

/**
 * Конвертирует JavaScript Date в timestamp (микросекунды)
 */
export function dateToTimestamp(date: Date): number {
  return date.getTime();
}

/**
 * Конвертирует gRPC Update в JSON формат для WebSocket
 */
export function grpcUpdateToJson(update: any): any {
  return {
    update_id: update.update_id || '',
    tenant_id: update.tenant_id || '',
    user_id: update.user_id || '',
    entity_id: update.entity_id || '',
    event_type: update.event_type || '',
    data: structToJson(update.data),
    created_at: update.created_at || 0,
  };
}

/**
 * Конвертирует gRPC Message в JSON формат
 */
export function grpcMessageToJson(message: any): any {
  return {
    message_id: message.message_id || '',
    dialog_id: message.dialog_id || '',
    sender_id: message.sender_id || '',
    type: message.type || '',
    content: message.content || '',
    meta: structToJson(message.meta),
    statuses: (message.statuses || []).map((status: any) => ({
      user_id: status.user_id,
      status: status.status,
      read_at: status.read_at || 0,
      created_at: status.created_at || 0,
    })),
    reaction_set: structToJson(message.reaction_set),
    sender_info: message.sender_info ? {
      user_id: message.sender_info.user_id,
      name: message.sender_info.name || '',
      created_at: message.sender_info.created_at || 0,
      meta: structToJson(message.sender_info.meta),
    } : undefined,
    created_at: message.created_at || 0,
    topic_id: message.topic_id || '',
    topic: structToJson(message.topic),
  };
}

/**
 * Конвертирует gRPC Dialog в JSON формат
 */
export function grpcDialogToJson(dialog: any): any {
  return {
    dialog_id: dialog.dialog_id || '',
    tenant_id: dialog.tenant_id || '',
    name: dialog.name || '',
    created_by: dialog.created_by || '',
    created_at: dialog.created_at || 0,
    updated_at: dialog.updated_at || 0,
    meta: structToJson(dialog.meta),
    member: dialog.member ? {
      user_id: dialog.member.user_id,
      meta: structToJson(dialog.member.meta),
      state: dialog.member.state ? {
        unread_count: dialog.member.state.unread_count || 0,
        last_seen_at: dialog.member.state.last_seen_at || 0,
        last_message_at: dialog.member.state.last_message_at || 0,
        is_active: dialog.member.state.is_active !== false,
      } : undefined,
    } : undefined,
    last_message: dialog.last_message ? grpcMessageToJson(dialog.last_message) : undefined,
  };
}
