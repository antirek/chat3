export interface Config {
  grpc: {
    host: string;
    port: number;
  };
  mongodb: {
    uri: string;
  };
  rabbitmq: {
    url: string;
  };
}

export function loadConfig(): Config {
  return {
    grpc: {
      host: process.env.GRPC_HOST || '0.0.0.0',
      port: parseInt(process.env.GRPC_PORT || '50051', 10)
    },
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chat3'
    },
    rabbitmq: {
      url: process.env.RABBITMQ_URL || 'amqp://localhost:5672'
    }
  };
}
