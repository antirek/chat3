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
import Pack from './data/Pack.js';
import PackLink from './data/PackLink.js';

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
import UserPackStats from './stats/UserPackStats.js';
import PackStats from './stats/PackStats.js';

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
  Pack,
  PackLink,
  UserStats,
  UserDialogStats,
  UserDialogActivity,
  MessageReactionStats,
  MessageStatusStats,
  UserTopicStats,
  DialogStats,
  UserPackStats,
  PackStats
};

// Export TypeScript interfaces - Data models
export type { ITenant } from './data/Tenant';
export type { IUser } from './data/User';
export type { IDialog } from './data/Dialog';
export type { IMessage } from './data/Message';
export type { IMeta } from './data/Meta';
export type { IApiKey, IApiKeyModel } from './data/ApiKey';
export type { IMessageStatus } from './data/MessageStatus';
export type { IDialogMember } from './data/DialogMember';
export type { IMessageReaction } from './data/MessageReaction';
export type { ITopic } from './data/Topic';
export type { IPack } from './data/Pack';
export type { IPackLink } from './data/PackLink';

// Export TypeScript interfaces - Operational models
import type { IEvent, EventType, EntityType, ActorType } from './operational/Event';
import type { IUpdate } from './operational/Update';
import type { IDialogReadTask, DialogReadTaskStatus } from './operational/DialogReadTask';
import type { ICounterHistory, CounterType, CounterEntityType, CounterOperation, CounterActorType } from './operational/CounterHistory';

export type { IEvent, EventType, EntityType, ActorType };
export type { IUpdate };
export type { IDialogReadTask, DialogReadTaskStatus };
export type { ICounterHistory, CounterType, CounterEntityType, CounterOperation, CounterActorType };

// Export TypeScript interfaces - Stats models
export type { IUserStats } from './stats/UserStats';
export type { IUserDialogStats } from './stats/UserDialogStats';
export type { IUserDialogActivity } from './stats/UserDialogActivity';
export type { IMessageReactionStats } from './stats/MessageReactionStats';
export type { IMessageStatusStats, MessageStatusType } from './stats/MessageStatusStats';
export type { IUserTopicStats } from './stats/UserTopicStats';
export type { IDialogStats } from './stats/DialogStats';
export type { IUserPackStats } from './stats/UserPackStats';
export type { IPackStats } from './stats/PackStats';

// Export TypeScript interfaces - Journals
export type { IApiJournal, HttpMethod } from './journals/ApiJournal';
