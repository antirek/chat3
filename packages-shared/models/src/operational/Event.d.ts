import mongoose from 'mongoose';
export type EventType = 'dialog.create' | 'dialog.update' | 'dialog.delete' | 'message.create' | 'message.update' | 'dialog.member.add' | 'dialog.member.remove' | 'dialog.member.update' | 'message.status.update' | 'message.reaction.update' | 'dialog.typing' | 'dialog.topic.create' | 'dialog.topic.update' | 'user.add' | 'user.update' | 'user.remove';
export type EntityType = 'dialog' | 'message' | 'dialogMember' | 'messageStatus' | 'messageReaction' | 'topic' | 'tenant' | 'user';
export type ActorType = 'user' | 'system' | 'bot' | 'api';
export interface IEvent extends mongoose.Document {
    eventId: string;
    tenantId: string;
    eventType: EventType;
    entityType: EntityType;
    entityId: string;
    actorId?: string;
    actorType: ActorType;
    data?: unknown;
    createdAt: number;
    description?: string;
}
declare const Event: mongoose.Model<IEvent, {}, {}, {}, mongoose.Document<unknown, {}, IEvent, {}, {}> & IEvent & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Event;
//# sourceMappingURL=Event.d.ts.map