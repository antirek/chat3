import mongoose from 'mongoose';
export interface IUser extends mongoose.Document {
    userId: string;
    tenantId: string;
    type: string;
    createdAt: number;
}
declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default User;
//# sourceMappingURL=User.d.ts.map