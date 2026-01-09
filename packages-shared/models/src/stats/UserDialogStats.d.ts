import mongoose from 'mongoose';
export interface IUserDialogStats extends mongoose.Document {
    tenantId: string;
    userId: string;
    dialogId: string;
    unreadCount: number;
    lastUpdatedAt: number;
    createdAt: number;
}
declare const UserDialogStats: mongoose.Model<IUserDialogStats, {}, {}, {}, mongoose.Document<unknown, {}, IUserDialogStats, {}, {}> & IUserDialogStats & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default UserDialogStats;
//# sourceMappingURL=UserDialogStats.d.ts.map