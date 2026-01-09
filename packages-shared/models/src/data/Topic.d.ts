import mongoose from 'mongoose';
export interface ITopic extends mongoose.Document {
    topicId: string;
    dialogId: string;
    tenantId: string;
    createdAt: number;
}
declare const Topic: mongoose.Model<ITopic, {}, {}, {}, mongoose.Document<unknown, {}, ITopic, {}, {}> & ITopic & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Topic;
//# sourceMappingURL=Topic.d.ts.map