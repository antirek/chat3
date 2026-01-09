import mongoose from 'mongoose';
export interface IUserTopicStats extends mongoose.Document {
    tenantId: string;
    userId: string;
    dialogId: string;
    topicId: string;
    unreadCount: number;
    lastUpdatedAt: number;
    createdAt: number;
}
declare const UserTopicStats: mongoose.Model<IUserTopicStats, {}, {}, {}, mongoose.Document<unknown, {}, IUserTopicStats, {}, {}> & IUserTopicStats & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default UserTopicStats;
//# sourceMappingURL=UserTopicStats.d.ts.map