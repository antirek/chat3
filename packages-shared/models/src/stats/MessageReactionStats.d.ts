import mongoose from 'mongoose';
export interface IMessageReactionStats extends mongoose.Document {
    tenantId: string;
    messageId: string;
    reaction: string;
    count: number;
    lastUpdatedAt: number;
    createdAt: number;
}
declare const MessageReactionStats: mongoose.Model<IMessageReactionStats, {}, {}, {}, mongoose.Document<unknown, {}, IMessageReactionStats, {}, {}> & IMessageReactionStats & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default MessageReactionStats;
//# sourceMappingURL=MessageReactionStats.d.ts.map