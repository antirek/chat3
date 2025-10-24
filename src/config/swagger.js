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
        url: 'http://localhost:3000',
        description: 'Development server'
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
      schemas: {
        Tenant: {
          type: 'object',
          required: ['name', 'domain'],
          properties: {
            _id: {
              type: 'string',
              description: 'Уникальный идентификатор'
            },
            name: {
              type: 'string',
              description: 'Название организации'
            },
            domain: {
              type: 'string',
              description: 'Доменное имя (уникальное)'
            },
            isActive: {
              type: 'boolean',
              description: 'Статус активности',
              default: true
            },
            settings: {
              type: 'object',
              description: 'Настройки организации',
              additionalProperties: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Дата создания'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Дата обновления'
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
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

