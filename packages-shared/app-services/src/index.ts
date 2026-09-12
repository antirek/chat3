export {
  AppServiceError,
  isAppServiceError,
  appServiceErrorToHttpStatus,
  appServiceErrorToHttpBody
} from './errors/AppServiceError.js';
export type { AppServiceErrorCode } from './errors/AppServiceError.js';

export {
  authenticateApiKey,
  assertPermission
} from './auth/authenticateApiKey.js';
export type {
  AuthenticateApiKeyInput,
  AuthenticatedContext
} from './auth/authenticateApiKey.js';

export {
  sendTyping,
  DEFAULT_TYPING_EXPIRES_MS
} from './typing/sendTyping.js';
export type {
  SendTypingInput,
  SendTypingResult
} from './typing/sendTyping.js';

export { setMessageStatus } from './status/setMessageStatus.js';
export type {
  SetMessageStatusInput,
  SetMessageStatusResult
} from './status/setMessageStatus.js';

export { setMessageReaction } from './reactions/setMessageReaction.js';
export type {
  SetMessageReactionInput,
  SetMessageReactionResult,
  ReactionAction
} from './reactions/setMessageReaction.js';

export { setMessageDeleted } from './messages/setMessageDeleted.js';
export type {
  SetMessageDeletedInput,
  SetMessageDeletedResult
} from './messages/setMessageDeleted.js';

export { sendMessage } from './messages/sendMessage.js';
export type {
  SendMessageInput,
  SendMessageResult
} from './messages/sendMessage.js';

export { listUserDialogs } from './dialogs/listUserDialogs.js';
export type {
  ListUserDialogsInput,
  ListUserDialogsResult,
  ListUserDialogsPagination
} from './dialogs/listUserDialogs.js';

export { listUserDialogMessages } from './dialogs/listUserDialogMessages.js';
export type {
  ListUserDialogMessagesInput,
  ListUserDialogMessagesResult,
  ListUserDialogMessagesPagination
} from './dialogs/listUserDialogMessages.js';

export { markDialogAllRead } from './dialogs/markDialogAllRead.js';
export type {
  MarkDialogAllReadInput,
  MarkDialogAllReadResult
} from './dialogs/markDialogAllRead.js';

export { upsertUser } from './users/upsertUser.js';
export type { UpsertUserInput, UpsertUserResult } from './users/upsertUser.js';

export { getUser } from './users/getUser.js';
export type { GetUserInput, GetUserResult } from './users/getUser.js';

export { createDialog } from './dialogs/createDialog.js';
export type { CreateDialogInput, CreateDialogResult } from './dialogs/createDialog.js';

export { findDialogByMeta } from './dialogs/findDialogByMeta.js';
export type {
  FindDialogByMetaInput,
  FindDialogByMetaResult
} from './dialogs/findDialogByMeta.js';

export { addDialogMembers } from './dialogs/addDialogMembers.js';
export type {
  AddDialogMembersInput,
  AddDialogMembersResult
} from './dialogs/addDialogMembers.js';

export { removeDialogMemberService } from './dialogs/removeDialogMember.js';
export type {
  RemoveDialogMemberInput,
  RemoveDialogMemberResult
} from './dialogs/removeDialogMember.js';

export { normalizeUserId } from './dialogs/dialogHelpers.js';
