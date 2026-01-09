import mongoose from 'mongoose';
export interface IDialogMember extends mongoose.Document {
    userId: string;
    tenantId: string;
    dialogId: string;
    createdAt: number;
}
declare const DialogMember: mongoose.Model<IDialogMember, {}, {}, {}, mongoose.Document<unknown, {}, IDialogMember, {}, {}> & IDialogMember & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default DialogMember;
//# sourceMappingURL=DialogMember.d.ts.map