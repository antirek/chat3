/**
 * Утилиты для работы с метаданными
 */
export function getEntityMeta(tenantId: any, entityType: any, entityId: any, _options?: {}): Promise<{}>;
export function getEntityMetaFull(tenantId: any, entityType: any, entityId: any, options?: {}): Promise<(import("mongoose").FlattenMaps<import("@chat3/models").IMeta> & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
})[]>;
export function setEntityMeta(tenantId: any, entityType: any, entityId: any, key: any, value: any, dataType?: string, options?: {}): Promise<import("mongoose").Document<unknown, {}, import("@chat3/models").IMeta, {}, {}> & import("@chat3/models").IMeta & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}>;
export function deleteEntityMeta(tenantId: any, entityType: any, entityId: any, key: any, options?: {}): Promise<boolean>;
export function getEntityMetaValue(tenantId: any, entityType: any, entityId: any, key: any, defaultValue?: any, options?: {}): Promise<any>;
export function buildMetaQuery(tenantId: any, entityType: any, metaFilters: any, options?: {}): Promise<{
    _id: {
        $in: any[];
    };
    messageId?: undefined;
    dialogId?: undefined;
    $or?: undefined;
} | {
    messageId: {
        $in: any[];
    };
    _id?: undefined;
    dialogId?: undefined;
    $or?: undefined;
} | {
    dialogId: {
        $in: any[];
    };
    _id?: undefined;
    messageId?: undefined;
    $or?: undefined;
} | {
    $or: {
        dialogId: any;
        userId: any;
    }[];
    _id?: undefined;
    messageId?: undefined;
    dialogId?: undefined;
}>;
//# sourceMappingURL=metaUtils.d.ts.map