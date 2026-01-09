import mongoose from 'mongoose';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export interface IApiJournal extends mongoose.Document {
    tenantId: string;
    method: HttpMethod;
    endpoint: string;
    statusCode: number;
    duration: number;
    requestSize?: number;
    responseSize?: number;
    requestBody?: unknown;
    createdAt: number;
}
declare const ApiJournal: mongoose.Model<IApiJournal, {}, {}, {}, mongoose.Document<unknown, {}, IApiJournal, {}, {}> & IApiJournal & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default ApiJournal;
//# sourceMappingURL=ApiJournal.d.ts.map