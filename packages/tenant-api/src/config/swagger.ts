import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat3 Tenant API',
      version: '1.0.0',
      description: 'REST API для управления чат-системой с поддержкой мультитенантности',
      contact: {
        name: 'API Support',
        email: 'support@chat3.com'
      },
      license: {
        name: 'ISC',
      }
    },
    servers: [
      {
        url: '{protocol}://{host}',
        description: 'Current server',
        variables: {
          protocol: {
            default: 'http',
            enum: ['http', 'https']
          },
          host: {
            default: 'localhost:3000'
          }
        }
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API ключ для аутентификации. Формат: chat3_<hex_string>'
        }
      },
      parameters: {
        TenantIdHeader: {
          in: 'header',
          name: 'X-TENANT-ID',
          schema: {
            type: 'string'
          },
          description: 'ID организации (tenant). Если не указан, используется дефолтный \'tnt_default\'',
          example: 'bch_j7m79gh'
        }
      },
      schemas: {
        Tenant: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Уникальный идентификатор MongoDB'
            },
            tenantId: {
              type: 'string',
              description: 'Уникальный идентификатор тенанта (до 20 символов)',
              maxLength: 20
            },
            createdAt: {
              type: 'number',
              description: 'Timestamp создания (микросекунды)'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Тип ошибки'
            },
            message: {
              type: 'string',
              description: 'Описание ошибки'
            },
            details: {
              type: 'object',
              description: 'Дополнительная информация об ошибке'
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Текущая страница'
            },
            limit: {
              type: 'integer',
              description: 'Элементов на странице'
            },
            total: {
              type: 'integer',
              description: 'Всего элементов'
            },
            pages: {
              type: 'integer',
              description: 'Всего страниц'
            }
          }
        },
        MetaIndexWhen: {
          type: 'object',
          required: ['key', 'op'],
          properties: {
            key: { type: 'string', description: 'Meta key to evaluate' },
            op: { type: 'string', enum: ['eq', 'in', 'ne', 'exists'] },
            value: { description: 'For eq/in/ne — comparison value; for exists — boolean' }
          }
        },
        MetaIndexRule: {
          type: 'object',
          required: ['keys', 'mode'],
          properties: {
            keys: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 50,
              description: 'Meta key names (1–3 for unique/required, up to 50 for allowed)'
            },
            mode: {
              type: 'string',
              enum: ['unique', 'required', 'allowed']
            },
            id: {
              type: 'string',
              pattern: '^[a-z0-9._-]{1,64}$',
              description: 'Optional custom indexId (for allowed must be allowed:keys if set)'
            },
            when: { $ref: '#/components/schemas/MetaIndexWhen' }
          }
        },
        MetaIndexDefinition: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            entityType: {
              type: 'string',
              enum: ['user', 'dialog', 'message', 'tenant', 'system', 'dialogMember', 'topic', 'pack']
            },
            indexId: { type: 'string', example: 'unique:contactId' },
            keys: { type: 'array', items: { type: 'string' } },
            mode: { type: 'string', enum: ['unique', 'required', 'allowed'] },
            when: { $ref: '#/components/schemas/MetaIndexWhen' }
          }
        },
        MetaIndexError: {
          allOf: [{ $ref: '#/components/schemas/Error' }],
          type: 'object',
          properties: {
            code: {
              type: 'string',
              enum: [
                'DUPLICATE_INDEX',
                'INDEX_KEYS_REQUIRED',
                'INDEX_VALUE_TYPE_NOT_ALLOWED',
                'INVALID_INDEX_SPEC',
                'INDEX_DEFINITION_CONFLICT',
                'INDEX_CONFLICT_EXISTING_DATA',
                'SCHEMA_CONFLICT_EXISTING_DATA',
                'INDEX_KEYS_NOT_IN_ALLOWLIST',
                'META_KEY_NOT_ALLOWED'
              ]
            },
            details: { type: 'object', additionalProperties: true }
          }
        }
      }
    },
    tags: [
      {
        name: 'Tenants',
        description: 'Управление организациями'
      },
      {
        name: 'Dialogs',
        description: 'Управление диалогами и участниками'
      },
      {
        name: 'Messages',
        description: 'Управление сообщениями в диалогах'
      },
      {
        name: 'MessageStatus',
        description: 'Управление статусом прочтения сообщений'
      },
      {
        name: 'DialogMember',
        description: 'Управление участниками диалогов и счетчиками непрочитанных сообщений'
      },
      {
        name: 'UserDialogs',
        description: 'Получение диалогов пользователя с пагинацией и сортировкой'
      },
      {
        name: 'UserPacks',
        description: 'Паки пользователя и паки диалога'
      },
      {
        name: 'Packs',
        description: 'Управление паками (создание, диалоги в паке, сообщения по паку)'
      },
      {
        name: 'Meta',
        description: 'Meta-теги сущностей и реестр правил индексации (unique, required, allowed)'
      }
    ]
  },
  apis: [
    join(__dirname, '../routes/*.js'),
    join(__dirname, '../controllers/*.js')
  ]
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
