/** entityType для Meta API и meta index registry */
export const META_ENTITY_TYPES = [
  'user',
  'dialog',
  'message',
  'tenant',
  'system',
  'dialogMember',
  'topic',
  'pack'
] as const;

export type MetaEntityType = (typeof META_ENTITY_TYPES)[number];

export type MetaIndexMode = 'unique' | 'required' | 'allowed';
