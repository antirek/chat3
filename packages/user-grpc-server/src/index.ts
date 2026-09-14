/**
 * gRPC User Server — domain via @chat3/app-services (not HTTP facade).
 */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as reflection from '@grpc/reflection';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import connectDB from '@chat3/utils/databaseUtils.js';
import { loadConfig } from './config/index.js';
import { wrapUnary, authenticateCall } from './auth/authenticateCall.js';
import { sendTypingIndicatorHandler } from './handlers/sendTypingIndicator.js';
import { setMessageStatusHandler } from './handlers/setMessageStatus.js';
import { setMessageReactionHandler } from './handlers/setMessageReaction.js';
import { setMessageDeletedHandler } from './handlers/setMessageDeleted.js';
import { getUserDialogsHandler } from './handlers/getUserDialogs.js';
import { getDialogMessagesHandler } from './handlers/getDialogMessages.js';
import { sendMessageHandler } from './handlers/sendMessage.js';
import { markDialogAllReadHandler } from './handlers/markDialogAllRead.js';
import { subscribeUpdatesHandler } from './handlers/subscribeUpdates.js';
import { subscribeTenantUpdatesHandler } from './handlers/subscribeTenantUpdates.js';
import { upsertUserHandler } from './handlers/upsertUser.js';
import { getUserHandler } from './handlers/getUser.js';
import { createDialogHandler } from './handlers/createDialog.js';
import { findDialogByMetaHandler } from './handlers/findDialogByMeta.js';
import { addDialogMembersHandler } from './handlers/addDialogMembers.js';
import { removeDialogMemberHandler } from './handlers/removeDialogMember.js';
import { getDialogHandler } from './handlers/getDialog.js';
import { listDialogMembersHandler } from './handlers/listDialogMembers.js';
import { updateDialogMetaHandler } from './handlers/updateDialogMeta.js';
import { RabbitMQClient } from './services/rabbitmqClient.js';
import { toGrpcServiceError } from './utils/errorMapper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

function resolveProtoPath(): string {
  try {
    const pkgJson = require.resolve('@chat3/user-grpc-proto/package.json');
    return path.join(path.dirname(pkgJson), 'src', 'chat3_user.proto');
  } catch {
    return path.join(__dirname, '../../../packages-shared/proto/src/chat3_user.proto');
  }
}

const config = loadConfig();
const PROTO_PATH = resolveProtoPath();

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [
    path.dirname(PROTO_PATH),
    path.dirname(require.resolve('protobufjs/package.json'))
  ]
});

const chat3Proto = grpc.loadPackageDefinition(packageDefinition) as any;
const chat3UserService = chat3Proto.chat3.user.Chat3UserService;

const rabbitmqClient = new RabbitMQClient({ url: config.rabbitmq.url });
const server = new grpc.Server();

server.addService(chat3UserService.service, {
  GetUserDialogs: wrapUnary('read', getUserDialogsHandler),
  GetDialogMessages: wrapUnary('read', getDialogMessagesHandler),
  SendMessage: wrapUnary('write', sendMessageHandler),
  SetMessageStatus: wrapUnary('write', setMessageStatusHandler),
  SetMessageReaction: wrapUnary('write', setMessageReactionHandler),
  SendTypingIndicator: wrapUnary('write', sendTypingIndicatorHandler),
  SetMessageDeleted: wrapUnary('write', setMessageDeletedHandler),
  MarkDialogAllRead: wrapUnary('write', markDialogAllReadHandler),
  UpsertUser: wrapUnary('write', upsertUserHandler),
  GetUser: wrapUnary('read', getUserHandler),
  CreateDialog: wrapUnary('write', createDialogHandler),
  FindDialogByMeta: wrapUnary('read', findDialogByMetaHandler),
  AddDialogMembers: wrapUnary('write', addDialogMembersHandler),
  RemoveDialogMember: wrapUnary('write', removeDialogMemberHandler),
  GetDialog: wrapUnary('read', getDialogHandler),
  ListDialogMembers: wrapUnary('read', listDialogMembersHandler),
  UpdateDialogMeta: wrapUnary('write', updateDialogMetaHandler),
  SubscribeUpdates: (call: grpc.ServerWritableStream<any, any>) => {
    authenticateCall(call.metadata, 'read')
      .then((auth) => subscribeUpdatesHandler(call, auth, rabbitmqClient))
      .catch((error) => call.destroy(toGrpcServiceError(error)));
  },
  SubscribeTenantUpdates: (call: grpc.ServerWritableStream<any, any>) => {
    subscribeTenantUpdatesHandler(call, rabbitmqClient).catch((error) =>
      call.destroy(toGrpcServiceError(error))
    );
  }
});

try {
  const reflectionService = new reflection.ReflectionService(packageDefinition);
  reflectionService.addToServer(server);
} catch (error) {
  console.warn('[user-grpc-server] Failed to enable reflection:', error);
}

async function startServer(): Promise<void> {
  process.env.MONGODB_URI = process.env.MONGODB_URI || config.mongodb.uri;
  await connectDB();
  await rabbitmqClient.connect();

  const bindAddress = `${config.grpc.host}:${config.grpc.port}`;
  await new Promise<void>((resolve, reject) => {
    server.bindAsync(bindAddress, grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

  console.log(`[user-grpc-server] listening on ${bindAddress} (plaintext)`);
}

startServer().catch((error) => {
  console.error('[user-grpc-server] failed to start:', error);
  process.exit(1);
});
