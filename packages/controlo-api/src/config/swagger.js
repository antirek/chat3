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
        url: process.env.CONTROL_APP_URL || 'http://localhost:3001',
        description: 'Gateway Server'
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
    './routes/*.js',
    './controllers/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default swaggerSpec;

