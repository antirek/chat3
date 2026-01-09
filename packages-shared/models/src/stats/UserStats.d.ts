import mongoose from 'mongoose';
export interface IUserStats extends mongoose.Document {
    tenantId: string;
    userId: string;
    dialogCount: number;
    unreadDialogsCount: number;
    totalUnreadCount: number;
    totalMessagesCount: number;
    lastUpdatedAt: number;
    createdAt: number;
}
declare const UserStats: mongoose.Model<IUserStats, {}, {}, {}, mongoose.Document<unknown, {}, IUserStats, {}, {}> & IUserStats & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default UserStats;
//# sourceMappingURL=UserStats.d.ts.map