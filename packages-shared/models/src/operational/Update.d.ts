import mongoose from 'mongoose';
export interface IUpdate extends mongoose.Document {
    tenantId: string;
    userId: string;
    entityId: string;
    eventId: string;
    eventType: string;
    data: unknown;
    published: boolean;
    publishedAt?: number;
    createdAt: number;
}
declare const Update: mongoose.Model<IUpdate, {}, {}, {}, mongoose.Document<unknown, {}, IUpdate, {}, {}> & IUpdate & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Update;
//# sourceMappingURL=Update.d.ts.map