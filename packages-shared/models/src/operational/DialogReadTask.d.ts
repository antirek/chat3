import mongoose from 'mongoose';
export type DialogReadTaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export interface IDialogReadTask extends mongoose.Document {
    tenantId: string;
    dialogId: string;
    userId: string;
    readUntil: number;
    status: DialogReadTaskStatus;
    processedCount: number;
    requestCount: number;
    lastProcessedAt: number | null;
    lastProcessedMessageId: mongoose.Types.ObjectId | null;
    source: string;
    error: string | null;
    createdAt: number;
    startedAt: number | null;
    finishedAt: number | null;
}
declare const DialogReadTask: mongoose.Model<IDialogReadTask, {}, {}, {}, mongoose.Document<unknown, {}, IDialogReadTask, {}, {}> & IDialogReadTask & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default DialogReadTask;
//# sourceMappingURL=DialogReadTask.d.ts.map