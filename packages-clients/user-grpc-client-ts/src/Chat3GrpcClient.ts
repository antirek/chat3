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

  async getDialog(options: {
    dialogId: string;
    userId?: string;
  }): Promise<any> {
    return this.unary('GetDialog', {
      dialog_id: options.dialogId,
      user_id: options.userId || ''
    });
  }

  async listDialogMembers(options: {
    dialogId: string;
    page?: number;
    limit?: number;
    userId?: string;
  }): Promise<any> {
    return this.unary('ListDialogMembers', {
      dialog_id: options.dialogId,
      page: options.page || 1,
      limit: options.limit || 50,
      user_id: options.userId || ''
    });
  }

  async updateDialogMeta(options: {
    userId: string;
    dialogId: string;
    meta: Record<string, any>;
  }): Promise<any> {
    return this.unary('UpdateDialogMeta', {
      user_id: options.userId,
      dialog_id: options.dialogId,
      meta: options.meta
    });
  }

  /**
   * Server-streaming SubscribeUpdates. One stream = one userId.
   * Yields connection.established first, then Updates from chat3_updates.
   */
  subscribeUpdates(userId: string): AsyncIterable<any> {
    return this.streamCall(this.client.SubscribeUpdates({ user_id: userId }, this.metadata));
  }

  /**
   * Firehose: tenant_ids empty = all tenants; otherwise listed tenants.
   */
  subscribeTenantUpdates(tenantIds: string[] = []): AsyncIterable<any> {
    // Metadata may omit tenant for scope; key still required.
    const meta = new grpc.Metadata();
    meta.add('x-api-key', this.metadata.get('x-api-key')[0] as string);
    return this.streamCall(
      this.client.SubscribeTenantUpdates({ tenant_ids: tenantIds }, meta)
    );
  }

  /**
   * Bidirectional multiplexed watch (personal binds on one stream).
   * Auth: api key only (tenant in each watch/unwatch command).
   */
  watchUpdates(): WatchUpdatesSession {
    const meta = new grpc.Metadata();
    meta.add('x-api-key', this.metadata.get('x-api-key')[0] as string);
    const call = this.client.WatchUpdates(meta);
    return new WatchUpdatesSession(call);
  }

  private streamCall(call: any): AsyncIterable<any> {
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

export type WatchUsersOpts = {
  tenantId: string;
  userIds: string[];
  userType?: string;
};

/**
 * Client helper for WatchUpdates bidi stream.
 */
export class WatchUpdatesSession {
  private pendingAcks = new Map<
    string,
    { resolve: (u: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
  >();
  private ackSeq = 0;
  private updateHandlers = new Set<(update: any) => void>();
  private established: Promise<any>;
  private establishedResolve!: (u: any) => void;
  private establishedReject!: (e: Error) => void;
  private closed = false;

  constructor(private readonly call: any) {
    this.established = new Promise((resolve, reject) => {
      this.establishedResolve = resolve;
      this.establishedReject = reject;
    });

    call.on('data', (update: any) => {
      const type = update?.source_event_type || update?.sourceEventType || '';
      if (type === 'connection.established') {
        this.establishedResolve(update);
      }
      if (type === 'watch.ack' || type === 'unwatch.ack' || type === 'watch.error') {
        // Resolve oldest pending of matching kind (FIFO for simplicity)
        const entry = this.pendingAcks.values().next().value as
          | { resolve: (u: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
          | undefined;
        if (entry) {
          const key = this.pendingAcks.keys().next().value as string;
          this.pendingAcks.delete(key);
          clearTimeout(entry.timer);
          if (type === 'watch.error') {
            entry.reject(
              new Error(
                update?.data?.error ||
                  update?.data?.fields?.error?.stringValue ||
                  'watch.error'
              )
            );
          } else {
            entry.resolve(update);
          }
        }
      }
      for (const handler of this.updateHandlers) {
        try {
          handler(update);
        } catch {
          /* ignore */
        }
      }
    });

    call.on('error', (err: Error) => {
      if (!this.closed) this.establishedReject(err);
      this.failPending(err);
    });
    call.on('end', () => {
      this.failPending(new Error('WatchUpdates ended'));
    });
  }

  onUpdate(handler: (update: any) => void): () => void {
    this.updateHandlers.add(handler);
    return () => this.updateHandlers.delete(handler);
  }

  waitEstablished(timeoutMs = 10000): Promise<any> {
    return Promise.race([
      this.established,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('WatchUpdates established timeout')), timeoutMs)
      )
    ]);
  }

  async watch(opts: WatchUsersOpts, timeoutMs = 10000): Promise<any> {
    await this.waitEstablished(timeoutMs);
    return this.sendCommand(
      {
        watch: {
          tenant_id: opts.tenantId,
          user_ids: opts.userIds,
          user_type: opts.userType || 'user'
        }
      },
      timeoutMs
    );
  }

  async unwatch(opts: WatchUsersOpts, timeoutMs = 10000): Promise<any> {
    await this.waitEstablished(timeoutMs);
    return this.sendCommand(
      {
        unwatch: {
          tenant_id: opts.tenantId,
          user_ids: opts.userIds,
          user_type: opts.userType || 'user'
        }
      },
      timeoutMs
    );
  }

  close(): void {
    this.closed = true;
    try {
      this.call.end();
    } catch {
      /* ignore */
    }
    try {
      this.call.cancel();
    } catch {
      /* ignore */
    }
  }

  private sendCommand(msg: Record<string, unknown>, timeoutMs: number): Promise<any> {
    const id = `ack_${++this.ackSeq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingAcks.delete(id);
        reject(new Error('WatchUpdates ack timeout'));
      }, timeoutMs);
      this.pendingAcks.set(id, { resolve, reject, timer });
      try {
        this.call.write(msg);
      } catch (err: any) {
        clearTimeout(timer);
        this.pendingAcks.delete(id);
        reject(err);
      }
    });
  }

  private failPending(err: Error) {
    for (const [key, entry] of this.pendingAcks) {
      clearTimeout(entry.timer);
      entry.reject(err);
      this.pendingAcks.delete(key);
    }
  }
}
