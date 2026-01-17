/**
 * Конфигурация gRPC сервера
 */

export interface Config {
  grpc: {
    host: string;
    port: number;
  };
  tenantApi: {
    url: string;
  };
  rabbitmq: {
    url: string;
  };
}

export function loadConfig(): Config {
  const grpcHost = process.env.GRPC_HOST || '0.0.0.0';
  const grpcPort = parseInt(process.env.GRPC_PORT || '50051', 10);
  const tenantApiUrl = process.env.TENANT_API_URL || 'http://localhost:3000';
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

  if (!tenantApiUrl) {
    throw new Error('TENANT_API_URL is required');
  }

  if (!rabbitmqUrl) {
    throw new Error('RABBITMQ_URL is required');
  }

  return {
    grpc: {
      host: grpcHost,
      port: grpcPort
    },
    tenantApi: {
      url: tenantApiUrl
    },
    rabbitmq: {
      url: rabbitmqUrl
    }
  };
}
