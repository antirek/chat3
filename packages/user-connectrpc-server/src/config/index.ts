/**
 * Конфигурация ConnectRPC сервера
 */

export interface Config {
  http: {
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
  const httpHost = process.env.CONNECT_HTTP_HOST || '0.0.0.0';
  const httpPort = parseInt(process.env.CONNECT_HTTP_PORT || '8080', 10);
  const tenantApiUrl = process.env.TENANT_API_URL || 'http://localhost:3000';
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

  if (!tenantApiUrl) {
    throw new Error('TENANT_API_URL is required');
  }

  if (!rabbitmqUrl) {
    throw new Error('RABBITMQ_URL is required');
  }

  return {
    http: {
      host: httpHost,
      port: httpPort
    },
    tenantApi: {
      url: tenantApiUrl
    },
    rabbitmq: {
      url: rabbitmqUrl
    }
  };
}
