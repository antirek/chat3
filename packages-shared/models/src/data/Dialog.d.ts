import mongoose from 'mongoose';
export interface IDialog extends mongoose.Document {
    dialogId: string;
    tenantId: string;
    createdAt: number;
}
declare const Dialog: mongoose.Model<IDialog, {}, {}, {}, mongoose.Document<unknown, {}, IDialog, {}, {}> & IDialog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Dialog;
//# sourceMappingURL=Dialog.d.ts.map