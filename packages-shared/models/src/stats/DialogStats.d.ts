import mongoose from 'mongoose';
export interface IDialogStats extends mongoose.Document {
    tenantId: string;
    dialogId: string;
    topicCount: number;
    memberCount: number;
    messageCount: number;
    lastUpdatedAt: number;
    createdAt: number;
}
declare const DialogStats: mongoose.Model<IDialogStats, {}, {}, {}, mongoose.Document<unknown, {}, IDialogStats, {}, {}> & IDialogStats & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default DialogStats;
//# sourceMappingURL=DialogStats.d.ts.map