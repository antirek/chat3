import mongoose from 'mongoose';
export interface IUserDialogActivity extends mongoose.Document {
    tenantId: string;
    userId: string;
    dialogId: string;
    lastSeenAt: number;
    lastMessageAt: number;
    lastUpdatedAt: number;
    createdAt: number;
}
declare const UserDialogActivity: mongoose.Model<IUserDialogActivity, {}, {}, {}, mongoose.Document<unknown, {}, IUserDialogActivity, {}, {}> & IUserDialogActivity & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default UserDialogActivity;
//# sourceMappingURL=UserDialogActivity.d.ts.map