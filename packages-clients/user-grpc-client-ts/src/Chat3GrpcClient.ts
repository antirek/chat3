/**
 * TypeScript client for Chat3 User gRPC (integrator API).
 * Auth: apiKey + tenantId in metadata.
 * User context: userId in each RPC request body.
 */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

export interface Chat3GrpcClientOptions {
  url: string;
  apiKey: string;
  tenantId: string;
}

export interface SetMessageStatusOptions {
  userId: string;
  dialogId: string;
  messageId: string;
  status: string;
}

export interface SetMessageReactionOptions {
  userId: string;
  dialogId?: string;
  messageId: string;
  reaction: string;
  set?: boolean;
}

export interface SendTypingIndicatorOptions {
  userId: string;
  dialogId: string;
}

export interface SendMessageOptions {
  userId: string;
  dialogId: string;
  content?: string;
  type?: string;
  meta?: Record<string, any>;
}

export interface GetUserDialogsOptions {
  userId: string;
  page?: number;
  limit?: number;
  filter?: string;
  sort?: string;
  includeLastMessage?: boolean;
}

export interface GetDialogMessagesOptions {
  userId: string;
  dialogId: string;
  page?: number;
  limit?: number;
  filter?: string;
  sort?: string;
}

function resolveProtoPath(): string {
  try {
    const pkgJson = require.resolve('@chat3/user-grpc-proto/package.json');
    return path.join(path.dirname(pkgJson), 'src', 'chat3_user.proto');
  } catch {
    return path.join(__dirname, '../../../packages-shared/proto/src/chat3_user.proto');
  }
}

function loadService(): any {
  const PROTO_PATH = resolveProtoPath();
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [path.dirname(require.resolve('protobufjs/package.json'))]
  });
  const chat3Proto = grpc.loadPackageDefinition(packageDefinition) as any;
  return chat3Proto.chat3.user.Chat3UserService;
}

const Chat3UserService = loadService();

export class Chat3GrpcClient {
  private client: any;
  private metadata: grpc.Metadata;

  constructor(options: Chat3GrpcClientOptions) {
    this.client = new Chat3UserService(options.url, grpc.credentials.createInsecure());
    this.metadata = new grpc.Metadata();
    this.metadata.add('x-api-key', options.apiKey);
    this.metadata.add('x-tenant-id', options.tenantId);
  }

  private unary(method: string, request: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client[method](request, this.metadata, (error: grpc.ServiceError | null, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async sendTypingIndicator(options: SendTypingIndicatorOptions): Promise<any> {
    return this.unary('SendTypingIndicator', {
      user_id: options.userId,
      dialog_id: options.dialogId
    });
  }

  async sendMessage(options: SendMessageOptions): Promise<any> {
    return this.unary('SendMessage', {
      user_id: options.userId,
      dialog_id: options.dialogId,
      content: options.content || '',
      type: options.type || 'internal.text',
      meta: options.meta
    });
  }

  async getUserDialogs(options: GetUserDialogsOptions): Promise<any> {
    return this.unary('GetUserDialogs', {
      user_id: options.userId,
      page: options.page || 1,
      limit: options.limit || 10,
      filter: options.filter || '',
      sort: options.sort || '',
      include_last_message: options.includeLastMessage || false
    });
  }

  async getDialogMessages(options: GetDialogMessagesOptions): Promise<any> {
    return this.unary('GetDialogMessages', {
      user_id: options.userId,
      dialog_id: options.dialogId,
      page: options.page || 1,
      limit: options.limit || 10,
      filter: options.filter || '',
      sort: options.sort || ''
    });
  }

  async markDialogAllRead(options: { userId: string; dialogId: string }): Promise<any> {
    return this.unary('MarkDialogAllRead', {
      user_id: options.userId,
      dialog_id: options.dialogId
    });
  }

  async setMessageStatus(options: SetMessageStatusOptions): Promise<any> {
    return this.unary('SetMessageStatus', {
      user_id: options.userId,
      dialog_id: options.dialogId,
      message_id: options.messageId,
      status: options.status
    });
  }

  async setMessageReaction(options: SetMessageReactionOptions): Promise<any> {
    return this.unary('SetMessageReaction', {
      user_id: options.userId,
      dialog_id: options.dialogId || '',
      message_id: options.messageId,
      reaction: options.reaction,
      set: options.set !== false
    });
  }

  async setMessageDeleted(options: {
    userId?: string;
    messageId: string;
    deleted: boolean;
    deletedBy?: string;
  }): Promise<any> {
    return this.unary('SetMessageDeleted', {
      user_id: options.userId || options.deletedBy || '',
      message_id: options.messageId,
      deleted: options.deleted,
      deleted_by: options.deletedBy || options.userId || ''
    });
  }

  async upsertUser(options: {
    userId: string;
    name?: string;
    type?: string;
    meta?: Record<string, any>;
  }): Promise<any> {
    return this.unary('UpsertUser', {
      user_id: options.userId,
      name: options.name || '',
      type: options.type || '',
      meta: options.meta
    });
  }

  async getUser(options: { userId: string }): Promise<any> {
    return this.unary('GetUser', {
      user_id: options.userId
    });
  }

  async createDialog(options: {
    userId: string;
    memberUserIds?: string[];
    meta?: Record<string, any>;
  }): Promise<any> {
    return this.unary('CreateDialog', {
      user_id: options.userId,
      member_user_ids: options.memberUserIds || [],
      meta: options.meta
    });
  }

  async findDialogByMeta(options: {
    userId?: string;
    metaKey: string;
    metaValue: string;
  }): Promise<any> {
    return this.unary('FindDialogByMeta', {
      user_id: options.userId || '',
      meta_key: options.metaKey,
      meta_value: options.metaValue
    });
  }

  async addDialogMembers(options: {
    userId: string;
    dialogId: string;
    memberUserIds: string[];
  }): Promise<any> {
    return this.unary('AddDialogMembers', {
      user_id: options.userId,
      dialog_id: options.dialogId,
      member_user_ids: options.memberUserIds
    });
  }

  async removeDialogMember(options: {
    userId: string;
    dialogId: string;
    memberUserId: string;
  }): Promise<any> {
    return this.unary('RemoveDialogMember', {
      user_id: options.userId,
      dialog_id: options.dialogId,
      member_user_id: options.memberUserId
    });
  }

  /**
   * Server-streaming SubscribeUpdates. One stream = one userId.
   * Yields connection.established first, then Updates from chat3_updates.
   */
  subscribeUpdates(userId: string): AsyncIterable<any> {
    const call = this.client.SubscribeUpdates({ user_id: userId }, this.metadata);
    const queue: any[] = [];
    let done = false;
    let error: Error | null = null;
    let wake: (() => void) | null = null;

    const notify = () => {
      if (wake) {
        const w = wake;
        wake = null;
        w();
      }
    };

    call.on('data', (update: any) => {
      queue.push(update);
      notify();
    });
    call.on('end', () => {
      done = true;
      notify();
    });
    call.on('error', (err: Error) => {
      error = err;
      done = true;
      notify();
    });

    return {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            while (queue.length === 0 && !done) {
              await new Promise<void>((resolve) => {
                wake = resolve;
              });
            }
            if (queue.length > 0) {
              return { value: queue.shift(), done: false };
            }
            if (error) {
              throw error;
            }
            return { value: undefined, done: true };
          },
          async return() {
            call.cancel();
            return { value: undefined, done: true };
          }
        };
      }
    };
  }

  close(): void {
    this.client.close();
  }
}
