import mongoose from 'mongoose';
export interface IMeta extends mongoose.Document {
    tenantId: string;
    entityType: 'user' | 'dialog' | 'message' | 'tenant' | 'system' | 'dialogMember' | 'topic';
    entityId: string;
    key: string;
    value: unknown;
    dataType: 'string' | 'number' | 'boolean' | 'object' | 'array';
    createdBy?: string;
    createdAt: number;
}
declare const Meta: mongoose.Model<IMeta, {}, {}, {}, mongoose.Document<unknown, {}, IMeta, {}, {}> & IMeta & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Meta;
//# sourceMappingURL=Meta.d.ts.map