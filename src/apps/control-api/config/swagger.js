import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat3 Control API',
      version: '1.0.0',
      description: 'Control API для управления инициализацией системы Chat3. Этот API предназначен для внутреннего использования и не требует аутентификации.',
      contact: {
        name: 'Chat3 API Support'
      }
    },
    servers: [
      {
        url: 'http://localhost:3002',
        description: 'Control API Server'
      }
    ],
    tags: [
      {
        name: 'Initialization',
        description: 'Эндпоинты для инициализации системы'
      },
      {
        name: 'Events & Updates',
        description: 'Эндпоинты для получения событий и обновлений (внутреннее использование)'
      }
    ]
  },
  apis: [
    './src/apps/control-api/routes/*.js',
    './src/apps/control-api/controllers/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default swaggerSpec;

