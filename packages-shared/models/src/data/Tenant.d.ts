import mongoose from 'mongoose';
export interface ITenant extends mongoose.Document {
    tenantId: string;
    createdAt: number;
}
declare const Tenant: mongoose.Model<ITenant, {}, {}, {}, mongoose.Document<unknown, {}, ITenant, {}, {}> & ITenant & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Tenant;
//# sourceMappingURL=Tenant.d.ts.map