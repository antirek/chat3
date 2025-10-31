import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSMongoose from '@adminjs/mongoose';

import { Tenant, Dialog, Message, Meta, ApiKey, MessageStatus, DialogMember, Event } from '../models/index.js';

// Register the mongoose adapter
AdminJS.registerAdapter({
  Resource: AdminJSMongoose.Resource,
  Database: AdminJSMongoose.Database,
});

// AdminJS configuration
const adminOptions = {
  resources: [
    {
      resource: Tenant,
      options: {
        navigation: {
          name: 'Система',
          icon: 'Building',
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          name: { isTitle: true },
          domain: { isRequired: true },
          type: {
            availableValues: [
              { value: 'system', label: 'Системный' },
              { value: 'client', label: 'Клиент' },
            ],
            isRequired: true,
          },
          settings: { 
            type: 'mixed',
            isVisible: { list: false, show: true, edit: true }
          },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: true, show: true, edit: false } },
        },
        listProperties: ['_id', 'name', 'domain', 'type', 'isActive', 'createdAt'],
        showProperties: ['_id', 'name', 'domain', 'type', 'isActive', 'settings', 'createdAt', 'updatedAt'],
      }
    },
    {
      resource: ApiKey,
      options: {
        navigation: {
          name: 'Система',
          icon: 'Key',
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          name: {
            isTitle: true,
            isRequired: true,
          },
          key: {
            isVisible: { list: false, show: true, edit: false },
            isRequired: true,
          },
          tenantId: {
            reference: 'Tenant',
            isRequired: true,
          },
          permissions: {
            isArray: true,
            availableValues: [
              { value: 'read', label: 'Чтение' },
              { value: 'write', label: 'Запись' },
              { value: 'delete', label: 'Удаление' },
            ],
          },
          isActive: {
            type: 'boolean',
            isVisible: { list: true, show: true, edit: true }
          },
          expiresAt: {
            type: 'datetime',
            isVisible: { list: true, show: true, edit: true }
          },
          lastUsedAt: {
            type: 'datetime',
            isVisible: { list: true, show: true, edit: false }
          },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } },
        },
        listProperties: ['_id', 'name', 'tenantId', 'permissions', 'isActive', 'lastUsedAt', 'createdAt'],
        filterProperties: ['name', 'tenantId', 'isActive'],
      }
    },
    {
      resource: Dialog,
      options: {
        navigation: {
          name: 'Чаты',
          icon: 'MessageCircle',
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          name: { isTitle: true },
          tenantId: {
            reference: 'Tenant',
            isRequired: true,
          },
          meta: {
            type: 'textarea',
            isVisible: { list: false, show: true, edit: false },
            position: 999,
          },
          dialogMembers: {
            type: 'textarea',
            isVisible: { list: false, show: true, edit: false },
            position: 998,
            description: 'Участники диалога с информацией о непрочитанных сообщениях',
          },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: true, show: true, edit: false } },
        },
        listProperties: ['_id', 'name', 'createdAt'],
        showProperties: ['_id', 'name', 'tenantId', 'createdAt', 'updatedAt', 'meta', 'dialogMembers'],
        filterProperties: ['name', 'tenantId'],
        actions: {
          show: {
            after: async (response, request, context) => {
              const { record } = context;
              if (record && record.params._id && record.params.tenantId) {
                try {
                  console.log('Loading meta for dialog:', record.params._id);
                  
                  // Загружаем метаданные диалога
                  const metaRecords = await Meta.find({
                    tenantId: record.params.tenantId,
                    entityType: 'dialog',
                    entityId: record.params._id
                  }).lean();
                  
                  console.log('Found meta records:', metaRecords.length);
                  
                  // Преобразуем в объект {key: value}
                  const metaObject = {};
                  metaRecords.forEach(m => {
                    metaObject[m.key] = m.value;
                  });
                  
                  console.log('Meta object:', metaObject);
                  
                  // Добавляем в record как JSON строку для отображения
                  record.params.meta = JSON.stringify(metaObject, null, 2);
                  
                  // Загружаем участников диалога
                  const { DialogMember } = await import('../models/index.js');
                  const dialogMembers = await DialogMember.find({
                    tenantId: record.params.tenantId,
                    dialogId: record.params._id
                  }).lean();
                  
                  console.log('Found dialog members:', dialogMembers.length);
                  
                  // Форматируем данные участников для отображения
                  const membersData = dialogMembers.map(member => ({
                    userId: member.userId,
                    unreadCount: member.unreadCount,
                    lastSeenAt: member.lastSeenAt,
                    lastMessageAt: member.lastMessageAt,
                    isActive: member.isActive,
                    createdAt: member.createdAt
                  }));
                  
                  console.log('Members data:', membersData);
                  
                  // Добавляем в record как JSON строку для отображения
                  record.params.dialogMembers = JSON.stringify(membersData, null, 2);
                } catch (error) {
                  console.error('Error loading dialog meta:', error);
                }
              }
              return response;
            }
          }
        },
      }
    },
    {
      resource: Message,
      options: {
        navigation: {
          name: 'Чаты',
          icon: 'Mail',
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          content: { 
            isTitle: true,
            type: 'textarea',
          },
          tenantId: {
            reference: 'Tenant',
            isRequired: true,
          },
          dialogId: {
            reference: 'Dialog',
            isRequired: true,
          },
          senderId: {
            type: 'string',
            isRequired: true,
            description: 'ID отправителя (произвольная строка)',
          },
          type: {
            type: 'string',
            description: 'Тип сообщения (любая строка)',
          },
          meta: {
            type: 'textarea',
            isVisible: { list: false, show: true, edit: false },
            description: 'Meta теги сообщения (channelType, channelId)',
          },
          messageStatuses: {
            type: 'textarea',
            isVisible: { list: false, show: true, edit: false },
            position: 998,
            description: 'Статусы прочтения сообщения для всех пользователей',
          },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: true, show: true, edit: false } },
        },
        listProperties: ['_id', 'content', 'dialogId', 'senderId', 'type', 'createdAt'],
        showProperties: ['_id', 'content', 'tenantId', 'dialogId', 'senderId', 'type', 'meta', 'messageStatuses', 'createdAt', 'updatedAt'],
        filterProperties: ['dialogId', 'senderId', 'type'],
        actions: {
          show: {
            after: async (response, request, context) => {
              const { record } = context;
              if (record && record.params._id && record.params.tenantId) {
                try {
                  console.log('Loading meta for message:', record.params._id);
                  
                  // Загружаем метаданные сообщения
                  const metaRecords = await Meta.find({
                    tenantId: record.params.tenantId,
                    entityType: 'message',
                    entityId: record.params._id
                  }).lean();
                  
                  console.log('Found meta records for message:', metaRecords.length);
                  
                  // Преобразуем в объект {key: value}
                  const metaObject = {};
                  metaRecords.forEach(m => {
                    metaObject[m.key] = m.value;
                  });
                  
                  console.log('Message meta object:', metaObject);
                  
                  // Добавляем в record как JSON строку для отображения
                  record.params.meta = JSON.stringify(metaObject, null, 2);
                  
                  // Загружаем статусы сообщения
                  const { MessageStatus } = await import('../models/index.js');
                  const messageStatuses = await MessageStatus.find({
                    tenantId: record.params.tenantId,
                    messageId: record.params._id
                  }).lean();
                  
                  console.log('Found message statuses:', messageStatuses.length);
                  
                  // Форматируем данные статусов для отображения
                  const statusesData = messageStatuses.map(status => ({
                    userId: status.userId,
                    status: status.status,
                    createdAt: status.createdAt,
                    updatedAt: status.updatedAt
                  }));
                  
                  console.log('Statuses data:', statusesData);
                  
                  // Добавляем в record как JSON строку для отображения
                  record.params.messageStatuses = JSON.stringify(statusesData, null, 2);
                } catch (error) {
                  console.error('Error loading message meta:', error);
                }
              }
              return response;
            }
          }
        },
      }
    },
    {
      resource: Meta,
      options: {
        navigation: {
          name: 'Чаты',
          icon: 'Tag',
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          key: { 
            isTitle: true,
            isRequired: true,
          },
          tenantId: {
            reference: 'Tenant',
            isRequired: true,
          },
          entityType: {
            availableValues: [
              { value: 'user', label: 'Пользователь' },
              { value: 'dialog', label: 'Диалог' },
              { value: 'message', label: 'Сообщение' },
              { value: 'tenant', label: 'Тенант' },
              { value: 'system', label: 'Система' },
            ],
            isRequired: true,
          },
          entityId: { isRequired: true },
          value: { 
            type: 'mixed',
            isRequired: true,
          },
          dataType: {
            availableValues: [
              { value: 'string', label: 'Строка' },
              { value: 'number', label: 'Число' },
              { value: 'boolean', label: 'Булево' },
              { value: 'object', label: 'Объект' },
              { value: 'array', label: 'Массив' },
            ],
            isRequired: true,
          },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: true, show: true, edit: false } },
        },
        listProperties: ['_id', 'key', 'entityType', 'dataType', 'createdAt'],
        filterProperties: ['key', 'entityType', 'entityId', 'tenantId'],
      }
    },
    {
      resource: MessageStatus,
      options: {
        navigation: {
          name: 'Чаты',
          icon: 'Eye',
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          messageId: {
            reference: 'Message',
            isRequired: true,
            isTitle: true,
          },
          userId: {
            type: 'string',
            isRequired: true,
            description: 'ID пользователя (строка)',
          },
          tenantId: {
            reference: 'Tenant',
            isRequired: true,
          },
          status: {
            availableValues: [
              { value: 'unread', label: 'Не прочитано' },
              { value: 'delivered', label: 'Доставлено' },
              { value: 'read', label: 'Прочитано' },
            ],
            isRequired: true,
          },
          readAt: {
            type: 'datetime',
            isVisible: { list: true, show: true, edit: false },
            description: 'Время прочтения',
          },
          deliveredAt: {
            type: 'datetime',
            isVisible: { list: true, show: true, edit: false },
            description: 'Время доставки',
          },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } },
        },
        listProperties: ['_id', 'messageId', 'userId', 'status', 'readAt', 'deliveredAt', 'createdAt'],
        showProperties: ['_id', 'messageId', 'userId', 'tenantId', 'status', 'readAt', 'deliveredAt', 'createdAt', 'updatedAt'],
        filterProperties: ['messageId', 'userId', 'tenantId', 'status'],
        sort: {
          sortBy: 'createdAt',
          direction: 'desc'
        }
      }
    },
    {
      resource: DialogMember,
      options: {
        navigation: {
          name: 'Чаты',
          icon: 'Users',
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          userId: {
            type: 'string',
            isRequired: true,
            description: 'ID пользователя (строка)',
            isTitle: true,
          },
          tenantId: {
            reference: 'Tenant',
            isRequired: true,
          },
          dialogId: {
            reference: 'Dialog',
            isRequired: true,
          },
          unreadCount: {
            type: 'number',
            isRequired: true,
            description: 'Количество непрочитанных сообщений',
          },
          lastSeenAt: {
            type: 'datetime',
            isVisible: { list: true, show: true, edit: false },
            description: 'Время последнего просмотра диалога',
          },
          lastMessageAt: {
            type: 'datetime',
            isVisible: { list: true, show: true, edit: false },
            description: 'Время последнего сообщения в диалоге',
          },
          isActive: {
            type: 'boolean',
            isVisible: { list: true, show: true, edit: true },
            description: 'Активен ли участник в диалоге',
          },
          createdAt: { isVisible: { list: true, show: true, edit: false } },
          updatedAt: { isVisible: { list: false, show: true, edit: false } },
        },
        listProperties: ['_id', 'userId', 'dialogId', 'unreadCount', 'lastSeenAt', 'lastMessageAt', 'isActive', 'createdAt'],
        showProperties: ['_id', 'userId', 'tenantId', 'dialogId', 'unreadCount', 'lastSeenAt', 'lastMessageAt', 'isActive', 'createdAt', 'updatedAt'],
        filterProperties: ['userId', 'dialogId', 'tenantId', 'isActive'],
        sort: {
          sortBy: 'lastSeenAt',
          direction: 'desc'
        }
      }
    },
    {
      resource: Event,
      options: {
        navigation: {
          name: 'Система',
          icon: 'Activity',
        },
        properties: {
          _id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          eventType: { 
            isTitle: true,
            availableValues: [
              { value: 'dialog.create', label: '📝 Dialog: Create' },
              { value: 'dialog.update', label: '📝 Dialog: Update' },
              { value: 'dialog.delete', label: '🗑️ Dialog: Delete' },
              { value: 'message.create', label: '💬 Message: Create' },
              { value: 'message.update', label: '💬 Message: Update' },
              { value: 'message.delete', label: '💬 Message: Delete' },
              { value: 'dialog.member.add', label: '👥 Member: Add' },
              { value: 'dialog.member.remove', label: '👥 Member: Remove' },
              { value: 'dialog.member.update', label: '👥 Member: Update' },
              { value: 'message.status.create', label: '✅ Status: Create' },
              { value: 'message.status.update', label: '✅ Status: Update' },
              { value: 'tenant.create', label: '🏢 Tenant: Create' },
              { value: 'tenant.update', label: '🏢 Tenant: Update' },
              { value: 'tenant.delete', label: '🏢 Tenant: Delete' },
            ],
            isRequired: true,
          },
          entityType: {
            availableValues: [
              { value: 'dialog', label: 'Dialog' },
              { value: 'message', label: 'Message' },
              { value: 'dialogMember', label: 'Dialog Member' },
              { value: 'messageStatus', label: 'Message Status' },
              { value: 'tenant', label: 'Tenant' },
            ],
            isRequired: true,
          },
          entityId: { 
            isRequired: true,
            description: 'ID сущности (ObjectId)',
          },
          tenantId: {
            reference: 'Tenant',
            isRequired: true,
          },
          actorId: {
            type: 'string',
            description: 'ID пользователя, который инициировал событие',
          },
          actorType: {
            availableValues: [
              { value: 'user', label: '👤 User' },
              { value: 'system', label: '⚙️ System' },
              { value: 'bot', label: '🤖 Bot' },
              { value: 'api', label: '🔌 API' },
            ],
          },
          data: { 
            type: 'textarea',
            isVisible: { list: false, show: true, edit: false },
            description: 'Дополнительные данные события (JSON)',
            position: 100,
          },
          'data.dialogId': {
            isVisible: false, // Скрыть автоматически развернутые поля
          },
          'data.dialogName': {
            isVisible: false,
          },
          'data.messageType': {
            isVisible: false,
          },
          'data.contentLength': {
            isVisible: false,
          },
          'data.userId': {
            isVisible: false,
          },
          'data.oldStatus': {
            isVisible: false,
          },
          'data.newStatus': {
            isVisible: false,
          },
          'data.messageId': {
            isVisible: false,
          },
          metadata: {
            type: 'textarea',
            isVisible: { list: false, show: true, edit: false },
            description: 'Метаданные: IP, User-Agent, API Key ID',
            position: 101,
          },
          'metadata.ipAddress': {
            isVisible: false, // Скрыть автоматически развернутые поля
          },
          'metadata.userAgent': {
            isVisible: false,
          },
          'metadata.apiKeyId': {
            isVisible: false,
          },
          'metadata.source': {
            isVisible: false,
          },
          description: {
            isVisible: { list: true, show: true, edit: false },
            description: 'Читаемое описание события (виртуальное поле)',
          },
          createdAt: { 
            isVisible: { list: true, show: true, edit: false },
            description: 'Время создания события',
          },
        },
        listProperties: ['eventType', 'description', 'entityType', 'actorId', 'actorType', 'createdAt'],
        showProperties: ['_id', 'eventType', 'description', 'entityType', 'entityId', 'tenantId', 'actorId', 'actorType', 'data', 'metadata', 'createdAt'],
        filterProperties: ['eventType', 'entityType', 'entityId', 'tenantId', 'actorId', 'actorType'],
        sort: {
          sortBy: 'createdAt',
          direction: 'desc'
        },
        actions: {
          new: {
            isVisible: false, // Запретить создание событий вручную
          },
          edit: {
            isVisible: false, // Запретить редактирование событий
          },
          delete: {
            isVisible: true,
            isAccessible: true,
          },
          bulkDelete: {
            isVisible: true,
            isAccessible: true,
          },
          show: {
            after: async (response, request, context) => {
              const { record } = context;
              if (record && record.params) {
                try {
                  // Собираем развернутые поля data.* обратно в объект data
                  if (!record.params.data || record.params.data === '{}' || record.params.data === '') {
                    const dataObj = {};
                    Object.keys(record.params).forEach(key => {
                      if (key.startsWith('data.') && record.params[key] !== undefined && record.params[key] !== null) {
                        const dataKey = key.replace('data.', '');
                        dataObj[dataKey] = record.params[key];
                      }
                    });
                    if (Object.keys(dataObj).length > 0) {
                      record.params.data = JSON.stringify(dataObj, null, 2);
                    }
                  } else {
                    // Если data уже есть, форматируем его как JSON
                    const dataValue = typeof record.params.data === 'string' 
                      ? JSON.parse(record.params.data) 
                      : record.params.data;
                    record.params.data = JSON.stringify(dataValue, null, 2);
                  }
                  
                  // Собираем развернутые поля metadata.* обратно в объект metadata
                  if (!record.params.metadata || record.params.metadata === '{}' || record.params.metadata === '') {
                    const metadataObj = {};
                    Object.keys(record.params).forEach(key => {
                      if (key.startsWith('metadata.') && record.params[key] !== undefined && record.params[key] !== null) {
                        const metaKey = key.replace('metadata.', '');
                        metadataObj[metaKey] = record.params[key];
                      }
                    });
                    if (Object.keys(metadataObj).length > 0) {
                      record.params.metadata = JSON.stringify(metadataObj, null, 2);
                    }
                  } else {
                    // Если metadata уже есть, форматируем его как JSON
                    const metadataValue = typeof record.params.metadata === 'string'
                      ? JSON.parse(record.params.metadata)
                      : record.params.metadata;
                    record.params.metadata = JSON.stringify(metadataValue, null, 2);
                  }
                } catch (error) {
                  console.error('Error formatting event data/metadata:', error);
                  // Если ошибка парсинга, оставляем как есть
                }
              }
              return response;
            }
          }
        }
      }
    },
  ],
  rootPath: '/admin',
  branding: {
    companyName: 'Chat3 Admin',
    logo: false,
    softwareBrothers: false,
    withMadeWithLove: false,
  },
  pages: {
    swagger: {
      label: '📚 Swagger API',
      icon: 'Book',
      handler: async (request, response, context) => {
        return {
          text: `
            <div style="padding: 40px; max-width: 900px; margin: 0 auto;">
              <h1 style="color: #3040D6; margin-bottom: 30px;">📚 API Documentation</h1>
              
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; margin-bottom: 30px;">
                <h2 style="color: white; margin-top: 0;">Swagger UI</h2>
                <p style="color: white; opacity: 0.9; font-size: 16px; line-height: 1.6;">
                  Интерактивная документация REST API с возможностью тестирования запросов прямо в браузере.
                </p>
                <a 
                  href="/api-docs" 
                  target="_blank"
                  style="
                    display: inline-block;
                    background: white;
                    color: #667eea;
                    padding: 15px 40px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: bold;
                    font-size: 18px;
                    margin-top: 20px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    transition: all 0.3s;
                  "
                  onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(0,0,0,0.3)';"
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.2)';"
                >
                  🚀 Открыть Swagger UI
                </a>
              </div>

              <div style="background: #f8f9fa; padding: 30px; border-radius: 12px; margin-bottom: 30px; border-left: 4px solid #667eea;">
                <h3 style="margin-top: 0; color: #333;">🔑 Доступные API Endpoints:</h3>
                <div style="font-family: monospace; font-size: 14px; line-height: 2;">
                  <div><strong>Tenants:</strong></div>
                  <div style="padding-left: 20px;">
                    • GET /api/tenants - Список организаций<br>
                    • POST /api/tenants - Создать организацию<br>
                    • GET /api/tenants/:id - Получить организацию<br>
                    • PUT /api/tenants/:id - Обновить организацию<br>
                    • DELETE /api/tenants/:id - Удалить организацию
                  </div>
                  <br>
                  <div><strong>Dialogs:</strong></div>
                  <div style="padding-left: 20px;">
                    • GET /api/dialogs - Список диалогов<br>
                    • POST /api/dialogs - Создать диалог<br>
                    • GET /api/dialogs/:id - Получить диалог<br>
                    • GET /api/dialogs/:id/participants - Участники диалога<br>
                    • POST /api/dialogs/:id/participants - Добавить участника<br>
                    • DELETE /api/dialogs/:id/participants/:userId - Удалить участника<br>
                    • PUT /api/dialogs/:id/participants/:userId/role - Изменить роль
                  </div>
                </div>
              </div>

              <div style="background: #fff3e0; padding: 25px; border-radius: 12px; border-left: 4px solid #ff9800;">
                <h3 style="margin-top: 0; color: #333;">🔐 Аутентификация API:</h3>
                <p style="line-height: 1.6;">
                  Все API запросы требуют заголовок <code style="background: #ffe0b2; padding: 2px 6px; border-radius: 3px;">X-API-Key</code>
                </p>
                <p style="line-height: 1.6; margin-bottom: 15px;">
                  Для генерации API ключа выполните в терминале:
                </p>
                <div style="background: #333; color: #0f0; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 14px;">
                  npm run generate-api-key
                </div>
              </div>

              <div style="background: #e3f2fd; padding: 25px; border-radius: 12px; margin-top: 30px; border-left: 4px solid #2196f3;">
                <h3 style="margin-top: 0; color: #333;">💡 Полезные ссылки:</h3>
                <ul style="line-height: 2;">
                  <li><a href="/admin" style="color: #667eea; font-weight: bold;">AdminJS Panel</a> - управление данными</li>
                  <li><a href="/api-docs" target="_blank" style="color: #667eea; font-weight: bold;">Swagger UI</a> - API документация</li>
                  <li><a href="/admin-links" target="_blank" style="color: #667eea; font-weight: bold;">Quick Links</a> - красивая страница со ссылками</li>
                  <li><a href="/" target="_blank" style="color: #667eea; font-weight: bold;">API Health Check</a> - проверка работы API</li>
                </ul>
              </div>
            </div>
          `
        };
      }
    }
  },
  locale: {
    language: 'ru',
    translations: {
      ru: {
        actions: {
          new: 'Создать',
          edit: 'Редактировать',
          show: 'Просмотр',
          delete: 'Удалить',
          bulkDelete: 'Массовое удаление',
          list: 'Список',
        },
        buttons: {
          save: 'Сохранить',
          filter: 'Фильтр',
          resetFilter: 'Сбросить',
          confirmRemovalMany: 'Подтвердить удаление',
          cancel: 'Отмена',
          login: 'Войти',
          logout: 'Выйти',
        },
        labels: {
          navigation: 'Навигация',
          pages: 'Страницы',
          selectedRecords: 'Выбрано ({{selected}})',
          filters: 'Фильтры',
          adminVersion: 'Версия админки',
          loginWelcome: 'Добро пожаловать в Chat3 Admin',
        },
        messages: {
          successfullyCreated: 'Успешно создано',
          successfullyUpdated: 'Успешно обновлено',
          successfullyDeleted: 'Успешно удалено',
          thereWereValidationErrors: 'Ошибки валидации',
          forbiddenError: 'Доступ запрещен',
          anyForbiddenError: 'Нет доступа к этому действию',
          successfullyBulkDeleted: 'Успешно удалено ({{count}})',
          loginWelcome: 'Войдите в систему',
        },
        properties: {
          length: 'Длина',
        },
      },
    },
  },
};

// Create AdminJS instance
const admin = new AdminJS(adminOptions);

// Build the router without authentication
const buildAdminRouter = (app) => {
  const adminRouter = AdminJSExpress.buildRouter(admin);
  return adminRouter;
};

export { admin, buildAdminRouter };

