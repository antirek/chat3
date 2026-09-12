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
      else out[k] = v;
    }
    return out;
  }
  return JSON.parse(JSON.stringify(meta));
}
