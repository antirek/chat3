/**
 * Swagger UI для ConnectRPC сервера
 * Генерирует OpenAPI спецификацию из proto файла
 */

import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к сгенерированной OpenAPI спецификации
const OPENAPI_SPEC_PATH = path.join(__dirname, '../../openapi.json');

export function setupSwaggerUI(app: Express) {
  // Загружаем OpenAPI спецификацию, если она существует
  let swaggerDocument: any = null;
  
  try {
    if (fs.existsSync(OPENAPI_SPEC_PATH)) {
      const specContent = fs.readFileSync(OPENAPI_SPEC_PATH, 'utf-8');
      swaggerDocument = JSON.parse(specContent);
      console.log('[Swagger] OpenAPI spec loaded from', OPENAPI_SPEC_PATH);
    } else {
      console.warn('[Swagger] OpenAPI spec not found at', OPENAPI_SPEC_PATH);
      console.warn('[Swagger] To generate OpenAPI spec, run: npm run generate:openapi');
      
      // Создаем минимальную спецификацию для демонстрации
      swaggerDocument = {
        openapi: '3.0.0',
        info: {
          title: 'Chat3 User ConnectRPC API',
          version: '1.0.0',
          description: 'ConnectRPC API для работы с пользователями, диалогами и сообщениями. Для генерации полной спецификации выполните: npm run generate:openapi'
        },
        paths: {
          '/chat3.user.Chat3UserService/GetUserDialogs': {
            post: {
              summary: 'GetUserDialogs',
              description: 'Получить диалоги пользователя',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        filter: { type: 'string' },
                        sort: { type: 'string' },
                        includeLastMessage: { type: 'boolean' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Success'
                }
              }
            }
          },
          '/chat3.user.Chat3UserService/GetDialogMessages': {
            post: {
              summary: 'GetDialogMessages',
              description: 'Получить сообщения диалога',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        dialogId: { type: 'string' },
                        page: { type: 'integer' },
                        limit: { type: 'integer' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Success'
                }
              }
            }
          },
          '/chat3.user.Chat3UserService/SendMessage': {
            post: {
              summary: 'SendMessage',
              description: 'Отправить сообщение',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        dialogId: { type: 'string' },
                        senderId: { type: 'string' },
                        content: { type: 'string' },
                        type: { type: 'string' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Success'
                }
              }
            }
          }
        }
      };
    }
  } catch (error: any) {
    console.error('[Swagger] Error loading OpenAPI spec:', error.message);
    return;
  }

  // Настройка Swagger UI
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Chat3 ConnectRPC API Documentation'
  }));

  console.log('[Swagger] Swagger UI available at http://localhost:8080/api-docs');
}
