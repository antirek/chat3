import mongoose from 'mongoose';
export interface IMessageReaction extends mongoose.Document {
    tenantId: string;
    messageId: string;
    userId: string;
    reaction: string;
    createdAt: number;
}
declare const MessageReaction: mongoose.Model<IMessageReaction, {}, {}, {}, mongoose.Document<unknown, {}, IMessageReaction, {}, {}> & IMessageReaction & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default MessageReaction;
//# sourceMappingURL=MessageReaction.d.ts.map