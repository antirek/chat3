import type { EntityType } from '@chat3/models';
/**
 * Утилиты для работы с метаданными
 */
interface GetEntityMetaOptions {
    [key: string]: unknown;
}
export declare function getEntityMeta(tenantId: string, entityType: EntityType, entityId: string, _options?: GetEntityMetaOptions): Promise<Record<string, unknown>>;
export declare function getEntityMetaFull(tenantId: string, entityType: EntityType, entityId: string, options?: GetEntityMetaOptions): Promise<unknown[]>;
interface SetEntityMetaOptions {
    createdBy?: string;
}
export declare function setEntityMeta(tenantId: string, entityType: EntityType, entityId: string, key: string, value: unknown, dataType?: 'string' | 'number' | 'boolean' | 'object' | 'array', options?: SetEntityMetaOptions): Promise<unknown>;
export declare function deleteEntityMeta(tenantId: string, entityType: EntityType, entityId: string, key: string, options?: GetEntityMetaOptions): Promise<boolean>;
export declare function getEntityMetaValue(tenantId: string, entityType: EntityType, entityId: string, key: string, defaultValue?: unknown, options?: GetEntityMetaOptions): Promise<unknown>;
export declare function buildMetaQuery(tenantId: string, entityType: EntityType, metaFilters: Record<string, unknown>, options?: GetEntityMetaOptions): Promise<Record<string, unknown> | null>;
export {};
//# sourceMappingURL=metaUtils.d.ts.map