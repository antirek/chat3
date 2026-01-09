import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat3 API',
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
      }
    ]
  },
  apis: [
    './routes/*.js',
    './controllers/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
