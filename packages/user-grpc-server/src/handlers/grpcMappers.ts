export function structFromObject(obj: Record<string, unknown> | undefined | null): any {
  if (!obj || typeof obj !== 'object') {
    return { fields: {} };
  }
  // Already Struct-shaped
  if (obj.fields && typeof obj.fields === 'object') {
    return obj;
  }
  const fields: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: 0 };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { numberValue: value };
    } else if (typeof value === 'boolean') {
      fields[key] = { boolValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        listValue: {
          values: value.map((item) => {
            if (typeof item === 'string') return { stringValue: item };
            if (typeof item === 'number') return { numberValue: item };
            if (typeof item === 'boolean') return { boolValue: item };
            if (item && typeof item === 'object') {
              return { structValue: structFromObject(item as Record<string, unknown>) };
            }
            return { nullValue: 0 };
          })
        }
      };
    } else if (typeof value === 'object') {
      fields[key] = { structValue: structFromObject(value as Record<string, unknown>) };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }
  return { fields };
}

export function toGrpcUser(user: any): any {
  if (!user) return undefined;
  return {
    user_id: user.userId || '',
    tenant_id: user.tenantId || '',
    type: user.type || 'user',
    created_at: user.createdAt || 0,
    meta: structFromObject(user.meta)
  };
}

export function toGrpcDialogInfo(dialog: any): any {
  if (!dialog) return undefined;
  return {
    dialog_id: dialog.dialogId || '',
    tenant_id: dialog.tenantId || '',
    created_at: dialog.createdAt || 0,
    meta: structFromObject(dialog.meta),
    member_user_ids: Array.isArray(dialog.memberUserIds) ? dialog.memberUserIds : []
  };
}

export function toGrpcDialogMember(member: any): any {
  if (!member) return undefined;
  const state = member.state || {};
  return {
    user_id: member.userId || member.user_id || '',
    meta: structFromObject(member.meta),
    state: {
      unread_count: state.unreadCount ?? state.unread_count ?? 0,
      last_seen_at: state.lastSeenAt ?? state.last_seen_at ?? 0,
      last_message_at: state.lastMessageAt ?? state.last_message_at ?? 0,
      is_active: state.isActive ?? state.is_active ?? true,
      joined_at: state.joinedAt ?? state.joined_at ?? 0
    }
  };
}

export function toGrpcDialogStatsLite(stats: any): any {
  if (!stats) return undefined;
  return {
    member_count: stats.memberCount ?? stats.member_count ?? 0,
    message_count: stats.messageCount ?? stats.message_count ?? 0,
    topic_count: stats.topicCount ?? stats.topic_count ?? 0
  };
}

function mapLastMessage(msg: any): any | undefined {
  if (!msg) return undefined;
  return {
    message_id: msg.messageId || '',
    dialog_id: msg.dialogId || '',
    sender_id: msg.senderId || '',
    type: msg.type || '',
    content: msg.content || '',
    meta: {},
    statuses: [],
    reaction_set: {},
    sender_info: msg.senderInfo
      ? {
          user_id: msg.senderInfo.userId || '',
          name: msg.senderInfo.name || '',
          created_at: msg.senderInfo.createdAt || 0,
          meta: msg.senderInfo.meta || {}
        }
      : undefined,
    created_at: msg.createdAt || 0,
    topic_id: msg.topicId || '',
    topic: {},
    deleted: msg.deleted === true,
    deleted_at: msg.deletedAt || 0,
    deleted_by: msg.deletedBy || '',
    status_message_matrix: {},
    edited: false,
    edited_at: 0,
    edited_by: ''
  };
}

/** Map listUserDialogs row → gRPC Dialog (GetUserDialogs). */
export function toGrpcDialogFromListRow(dialog: any): any {
  const context = dialog.context || {};
  const stats = dialog.stats || {};
  const membersCount =
    dialog.membersCount ?? stats.memberCount ?? stats.member_count ?? 0;
  return {
    dialog_id: dialog.dialogId || '',
    tenant_id: dialog.tenantId || '',
    name: dialog.name || '',
    created_by: dialog.createdBy || '',
    created_at: dialog.createdAt || 0,
    updated_at: dialog.updatedAt || 0,
    meta: dialog.meta ? structFromObject(dialog.meta) : { fields: {} },
    member: {
      user_id: context.userId || '',
      meta: {},
      state: {
        unread_count: context.unreadCount || 0,
        last_seen_at: context.lastSeenAt || 0,
        last_message_at: context.lastMessageAt || 0,
        is_active: true,
        joined_at: context.joinedAt || 0
      }
    },
    last_message: mapLastMessage(dialog.lastMessage),
    members_count: membersCount,
    stats: {
      member_count: stats.memberCount ?? membersCount ?? 0,
      message_count: stats.messageCount ?? 0,
      topic_count: stats.topicCount ?? 0
    }
  };
}

export function metaFromRequest(meta: any): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  // Incoming Struct → plain
  if (meta.fields && typeof meta.fields === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta.fields as Record<string, any>)) {
      if (!v) continue;
      if (v.stringValue !== undefined) out[k] = v.stringValue;
      else if (v.numberValue !== undefined) out[k] = v.numberValue;
      else if (v.boolValue !== undefined) out[k] = v.boolValue;
      else if (v.structValue) out[k] = metaFromRequest(v.structValue);
      else if (v.listValue?.values) {
        out[k] = v.listValue.values.map((item: any) => valueFromProtobuf(item));
      } else if (v.nullValue !== undefined) out[k] = null;
      else out[k] = v;
    }
    return out;
  }
  return JSON.parse(JSON.stringify(meta));
}

/** Decode google.protobuf.Value (from proto-loader). */
export function valueFromProtobuf(value: any): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.numberValue !== undefined) return value.numberValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.nullValue !== undefined) return null;
  if (value.structValue) return metaFromRequest(value.structValue) ?? {};
  if (value.listValue?.values) {
    return value.listValue.values.map((item: any) => valueFromProtobuf(item));
  }
  // Plain JS already (client helpers sometimes pass raw)
  return value;
}

/** Encode plain JS → google.protobuf.Value shape for proto-loader. */
export function valueToProtobuf(value: unknown): any {
  if (value === null || value === undefined) return { nullValue: 0 };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return { numberValue: value };
  if (typeof value === 'boolean') return { boolValue: value };
  if (Array.isArray(value)) {
    return {
      listValue: { values: value.map((item) => valueToProtobuf(item)) }
    };
  }
  if (typeof value === 'object') {
    return { structValue: structFromObject(value as Record<string, unknown>) };
  }
  return { stringValue: String(value) };
}

export function toGrpcMessage(msg: any): any {
  if (!msg) return undefined;
  const statuses = (msg.statuses || []).map((s: any) => ({
    user_id: s.userId || s.user_id || '',
    status: s.status || '',
    read_at:
      s.readAt ||
      s.read_at ||
      (String(s.status || '').toLowerCase() === 'read' ? s.createdAt || s.created_at || 0 : 0),
    created_at: s.createdAt || s.created_at || 0
  }));
  return {
    message_id: msg.messageId || msg.message_id || '',
    dialog_id: msg.dialogId || msg.dialog_id || '',
    sender_id: msg.senderId || msg.sender_id || '',
    type: msg.type || '',
    content: msg.content || '',
    meta: structFromObject(msg.meta),
    statuses,
    reaction_set: structFromObject(msg.reactionSet || msg.reaction_set),
    sender_info: msg.senderInfo || msg.sender_info
      ? {
          user_id: (msg.senderInfo || msg.sender_info).userId || (msg.senderInfo || msg.sender_info).user_id || '',
          name: (msg.senderInfo || msg.sender_info).name || '',
          created_at: (msg.senderInfo || msg.sender_info).createdAt || (msg.senderInfo || msg.sender_info).created_at || 0,
          meta: structFromObject((msg.senderInfo || msg.sender_info).meta)
        }
      : undefined,
    created_at: msg.createdAt || msg.created_at || 0,
    topic_id: msg.topicId || msg.topic_id || '',
    topic: structFromObject(msg.topic),
    deleted: msg.deleted === true,
    deleted_at: msg.deletedAt || msg.deleted_at || 0,
    deleted_by: msg.deletedBy || msg.deleted_by || '',
    status_message_matrix: structFromObject(
      msg.statusMessageMatrix || msg.status_message_matrix
    ),
    edited: msg.edited === true,
    edited_at: msg.editedAt || msg.edited_at || 0,
    edited_by: msg.editedBy || msg.edited_by || ''
  };
}

export function toGrpcMessageStatus(s: any): any {
  if (!s) return undefined;
  return {
    user_id: s.userId || s.user_id || '',
    status: s.status || '',
    read_at:
      s.readAt ||
      s.read_at ||
      (String(s.status || '').toLowerCase() === 'read' ? s.createdAt || s.created_at || 0 : 0),
    created_at: s.createdAt || s.created_at || 0
  };
}
