import mongoose from 'mongoose';
export type CounterType = 'userDialogStats.unreadCount' | 'messageReactionStats.count' | 'messageStatusStats.count' | 'userStats.dialogCount' | 'userStats.unreadDialogsCount' | 'userStats.totalUnreadCount' | 'userStats.totalMessagesCount';
export type CounterEntityType = 'dialogMember' | 'message' | 'user' | 'userDialogStats' | 'messageReactionStats' | 'messageStatusStats';
export type CounterOperation = 'increment' | 'decrement' | 'set' | 'reset' | 'computed';
export type CounterActorType = 'user' | 'bot' | 'api' | 'system';
export interface ICounterHistory extends mongoose.Document {
    tenantId: string;
    counterType: CounterType;
    entityType: CounterEntityType;
    entityId: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
    delta?: number;
    operation: CounterOperation;
    sourceOperation: string;
    sourceEntityId?: string;
    actorId?: string;
    actorType: CounterActorType;
    createdAt: number;
}
declare const CounterHistory: mongoose.Model<ICounterHistory, {}, {}, {}, mongoose.Document<unknown, {}, ICounterHistory, {}, {}> & ICounterHistory & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default CounterHistory;
//# sourceMappingURL=CounterHistory.d.ts.map