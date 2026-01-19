/**
 * Конфигурация backend для user2user-connectrpc
 */

export interface Config {
  port: number;
  connectrpcServerUrl: string;
}

export const config: Config = {
  port: parseInt(process.env.USER2USER_CONNECTRPC_PORT || '4001', 10),
  connectrpcServerUrl: process.env.CONNECTRPC_SERVER_URL || 'http://localhost:8080'
};
