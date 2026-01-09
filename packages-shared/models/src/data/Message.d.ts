import mongoose from 'mongoose';
export interface IMessage extends mongoose.Document {
    messageId: string;
    tenantId: string;
    dialogId: string;
    topicId: string | null;
    senderId: string;
    content: string;
    type: string;
    quotedMessage: unknown | null;
    createdAt: number;
}
declare const Message: mongoose.Model<IMessage, {}, {}, {}, mongoose.Document<unknown, {}, IMessage, {}, {}> & IMessage & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Message;
//# sourceMappingURL=Message.d.ts.map