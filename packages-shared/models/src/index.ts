// Data models
import Tenant from './data/Tenant.js';
import User from './data/User.js';
import Dialog from './data/Dialog.js';
import Message from './data/Message.js';
import Meta from './data/Meta.js';
import ApiKey from './data/ApiKey.js';
import MessageStatus from './data/MessageStatus.js';
import DialogMember from './data/DialogMember.js';
import MessageReaction from './data/MessageReaction.js';
import Topic from './data/Topic.js';

// Operational models
import Event from './operational/Event.js';
import Update from './operational/Update.js';
import DialogReadTask from './operational/DialogReadTask.js';
import CounterHistory from './operational/CounterHistory.js';

// Journals
import ApiJournal from './journals/ApiJournal.js';

// Stats models
import UserStats from './stats/UserStats.js';
import UserDialogStats from './stats/UserDialogStats.js';
import UserDialogActivity from './stats/UserDialogActivity.js';
import MessageReactionStats from './stats/MessageReactionStats.js';
import MessageStatusStats from './stats/MessageStatusStats.js';
import UserTopicStats from './stats/UserTopicStats.js';
import DialogStats from './stats/DialogStats.js';

// Export models
export {
  Tenant,
  User,
  Dialog,
  Message,
  Meta,
  ApiKey,
  MessageStatus,
  DialogMember,
  Event,
  MessageReaction,
  Update,
  ApiJournal,
  DialogReadTask,
  CounterHistory,
  Topic,
  UserStats,
  UserDialogStats,
  UserDialogActivity,
  MessageReactionStats,
  MessageStatusStats,
  UserTopicStats,
  DialogStats
};

// Export TypeScript interfaces - Data models
export type { ITenant } from './data/Tenant.js';
export type { IUser } from './data/User.js';
export type { IDialog } from './data/Dialog.js';
export type { IMessage } from './data/Message.js';
export type { IMeta } from './data/Meta.js';
export type { IApiKey, IApiKeyModel } from './data/ApiKey.js';
export type { IMessageStatus } from './data/MessageStatus.js';
export type { IDialogMember } from './data/DialogMember.js';
export type { IMessageReaction } from './data/MessageReaction.js';
export type { ITopic } from './data/Topic.js';

// Export TypeScript interfaces - Operational models
export type { IEvent, EventType } from './operational/Event.js';
export type { EntityType, ActorType } from './operational/Event.js';
export type { IUpdate } from './operational/Update.js';
export type { IDialogReadTask, DialogReadTaskStatus } from './operational/DialogReadTask.js';
export type { ICounterHistory, CounterType, CounterEntityType, CounterOperation, CounterActorType } from './operational/CounterHistory.js';

// Export TypeScript interfaces - Stats models
export type { IUserStats } from './stats/UserStats.js';
export type { IUserDialogStats } from './stats/UserDialogStats.js';
export type { IUserDialogActivity } from './stats/UserDialogActivity.js';
export type { IMessageReactionStats } from './stats/MessageReactionStats.js';
export type { IMessageStatusStats, MessageStatusType } from './stats/MessageStatusStats.js';
export type { IUserTopicStats } from './stats/UserTopicStats.js';
export type { IDialogStats } from './stats/DialogStats.js';

// Export TypeScript interfaces - Journals
export type { IApiJournal, HttpMethod } from './journals/ApiJournal.js';
