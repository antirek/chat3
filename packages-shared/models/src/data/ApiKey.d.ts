import mongoose from 'mongoose';
export interface IApiKey extends mongoose.Document {
    key: string;
    name: string;
    description?: string;
    isActive: boolean;
    permissions: string[];
    expiresAt?: number;
    lastUsedAt?: number;
    createdAt: number;
    isValid(): boolean;
    updateLastUsed(): Promise<void>;
}
export interface IApiKeyModel extends mongoose.Model<IApiKey> {
    generateKey(): string;
}
declare const ApiKey: IApiKeyModel;
export default ApiKey;
//# sourceMappingURL=ApiKey.d.ts.map