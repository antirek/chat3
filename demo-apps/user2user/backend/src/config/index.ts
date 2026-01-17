import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.USER2USER_PORT || '4000', 10),
  grpcServerUrl: process.env.GRPC_SERVER_URL || 'localhost:50051',
  tenantId: process.env.TENANT_ID || 'tnt_default',
};
