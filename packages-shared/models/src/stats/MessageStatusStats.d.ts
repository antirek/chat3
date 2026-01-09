import mongoose from 'mongoose';
export type MessageStatusType = 'sent' | 'unread' | 'delivered' | 'read';
export interface IMessageStatusStats extends mongoose.Document {
    tenantId: string;
    messageId: string;
    status: MessageStatusType;
    count: number;
    lastUpdatedAt: number;
    createdAt: number;
}
declare const MessageStatusStats: mongoose.Model<IMessageStatusStats, {}, {}, {}, mongoose.Document<unknown, {}, IMessageStatusStats, {}, {}> & IMessageStatusStats & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default MessageStatusStats;
//# sourceMappingURL=MessageStatusStats.d.ts.map