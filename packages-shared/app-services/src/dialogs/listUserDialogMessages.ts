import {
  DialogMember, Dialog, Message,
  Meta, MessageStatus
} from '@chat3/models';
import * as topicUtils from '@chat3/utils/topicUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import {
  parseFilters,
  extractMetaFilters,
  parseSort,
  buildFilterQuery
} from '@chat3/utils/queryParser.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import {
  getSenderInfo,
  buildStatusMessageMatrix,
  buildReactionSet,
  getContextUserInfo
} from '@chat3/utils/userDialogUtils.js';
import { AppServiceError, isAppServiceError } from '../errors/AppServiceError.js';

export interface ListUserDialogMessagesInput {
  tenantId: string;
  userId: string;
  dialogId: string;
  page?: number;
  limit?: number;
  filter?: string | null;
  sort?: string | null;
}

export interface ListUserDialogMessagesPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ListUserDialogMessagesResult {
  data: any[];
  pagination: ListUserDialogMessagesPagination;
}

/**
 * List messages in a dialog for a specific user context.
 * Shared by REST and gRPC.
 */
export async function listUserDialogMessages(
  input: ListUserDialogMessagesInput
): Promise<ListUserDialogMessagesResult> {
  const {
    tenantId,
    userId,
    dialogId,
    filter = null,
    sort = null
  } = input;

  if (!tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }
  if (!userId) {
    throw new AppServiceError('VALIDATION', 'userId is required');
  }
  if (!dialogId) {
    throw new AppServiceError('VALIDATION', 'dialogId is required');
  }

  const page = input.page && input.page > 0 ? input.page : 1;
  const limit = input.limit && input.limit > 0 ? input.limit : 50;
  const skip = (page - 1) * limit;

  const fetchMeta = (entityType: any, entityId: string) => metaUtils.getEntityMeta(
    tenantId,
    entityType,
    entityId
  );

// 1. Проверяем, что пользователь является участником диалога
const member = await DialogMember.findOne({
  tenantId: tenantId,
  dialogId: dialogId,
  userId: userId
});

if (!member) {
  throw new AppServiceError('FORBIDDEN', 'User is not a member of this dialog');
}

// 2. Получаем диалог для проверки существования
const dialog = await Dialog.findOne({
  tenantId: tenantId,
  dialogId: dialogId
});

if (!dialog) {
  throw new AppServiceError('NOT_FOUND', 'Dialog not found');
}

// 3. Получаем сообщения диалога
const query: any = {
  tenantId: tenantId,
  dialogId: dialogId
};

// Поддержка фильтрации
if (filter) {
  try {
    const parsedFilters = parseFilters(String(filter));
    const extracted = extractMetaFilters(parsedFilters);
    if ('branches' in extracted) {
      const filterQuery = await buildFilterQuery(tenantId, 'message', parsedFilters);
      Object.assign(query, filterQuery);
    } else {
    const { metaFilters, regularFilters } = extracted;
    
    // Применяем обычные фильтры
    for (const [field, condition] of Object.entries(regularFilters)) {
      // Валидация: отклоняем старый формат (topicId,*)
      if (field === 'topicId') {
        throw new AppServiceError('VALIDATION', 'Filter format (topicId,*) is deprecated. Use (topic.topicId,*) instead.');
      }
      
      // Обработка нового формата topic.topicId
      if (field === 'topic' && condition && typeof condition === 'object' && condition !== null) {
        const conditionObj = condition as any;
        if (conditionObj.topicId !== undefined) {
          const topicIdCondition = conditionObj.topicId;
          
          // Обрабатываем null отдельно (typeof null === 'object' в JavaScript)
          if (topicIdCondition === null || topicIdCondition === 'null') {
            query.topicId = null;
          } else if (typeof topicIdCondition === 'object') {
            if (topicIdCondition.$eq !== undefined) {
              // Обрабатываем $eq, включая null
              if (topicIdCondition.$eq === null || topicIdCondition.$eq === 'null') {
                query.topicId = null;
              } else {
                query.topicId = topicIdCondition.$eq;
              }
            } else if (topicIdCondition.$ne === null || topicIdCondition.$ne === 'null') {
              query.topicId = { $ne: null }; // Не null
            } else {
              query.topicId = topicIdCondition;
            }
          } else {
            query.topicId = topicIdCondition;
          }
        } else {
          // Другие поля topic (если будут добавлены в будущем)
          query[field] = condition;
        }
      } else {
        query[field] = condition;
      }
    }
    
    // Для meta фильтров используем отдельную логику
    if (Object.keys(metaFilters).length > 0) {
      const metaQuery: any = {
        tenantId: tenantId,
        entityType: 'message'
      };
      
      const messageIdsFromMeta: string[] = [];
      for (const [key, condition] of Object.entries(metaFilters)) {
        metaQuery.key = key.replace('meta.', '');
        metaQuery.value = condition;
        
        const metaDocs = await Meta.find(metaQuery).select('entityId');
        const ids = metaDocs.map(doc => doc.entityId);
        messageIdsFromMeta.push(...ids);
      }
      
      if (messageIdsFromMeta.length > 0) {
        query.messageId = { $in: messageIdsFromMeta };
      } else {
        // Если meta фильтры не дали результатов, возвращаем пустой список
        return {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0
          }
        };
      }
    }
    }
  } catch (err: any) {
    if (isAppServiceError(err)) {
      throw err;
    }
    console.error('Error parsing filter:', err);
    throw new AppServiceError('VALIDATION', 'Invalid filter format');
  }
}

// Получаем общее количество
const total = await Message.countDocuments(query);

// Получаем сообщения с сортировкой по времени создания (новые сначала по умолчанию)
let sortOption: any = '-createdAt'; // По умолчанию

if (sort) {
  // Пробуем распарсить формат (field,direction)
  const parsedSort = parseSort(String(sort));
  if (parsedSort) {
    sortOption = parsedSort;
  } else {
    // Если не удалось распарсить, используем как есть (для обратной совместимости)
    sortOption = String(sort);
  }
}

const messages = await Message.find(query)
  .sort(sortOption)
  .skip(skip)
  .limit(limit)
  .lean();

// 4. Получаем все статусы для всех сообщений одним запросом (оптимизация)
const messageIds = messages.map(m => m.messageId);
const allStatuses = await MessageStatus.find({
  tenantId: tenantId,
  messageId: { $in: messageIds }
}).select('messageId userId userType tenantId status createdAt').lean();

// Группируем статусы по messageId для быстрого доступа
const statusesByMessage: Record<string, any[]> = {};
allStatuses.forEach(status => {
  if (!statusesByMessage[status.messageId]) {
    statusesByMessage[status.messageId] = [];
  }
  statusesByMessage[status.messageId].push(status);
});

const senderInfoCache = new Map<string, any>();

// 4.5. Загружаем информацию о пользователе из контекста
const contextUserInfo = await getContextUserInfo(tenantId, userId, fetchMeta);
if (contextUserInfo) {
  senderInfoCache.set(contextUserInfo.userId, contextUserInfo);
}

// 4.6. Получаем все топики для сообщений одним запросом (оптимизация N+1)
const topicIds = [...new Set(messages
  .map(msg => msg.topicId)
  .filter(id => id !== null && id !== undefined)
)];

let topicsMap = new Map<string, any>();
if (topicIds.length > 0) {
  try {
    topicsMap = await topicUtils.getTopicsWithMetaBatch(tenantId, dialogId, topicIds);
  } catch (error) {
    console.error('Error getting topics with meta batch:', error);
    // Продолжаем выполнение, topicsMap останется пустым
  }
}

// 5. Обогащаем сообщения контекстными данными для пользователя
const enrichedMessages = await Promise.all(
  messages.map(async (message) => {
    // Получаем статусы для этого сообщения
    // const messageStatuses = statusesByMessage[message.messageId] || [];
    
    // Находим статусы для текущего пользователя (может быть несколько записей)
    // const myStatuses = messageStatuses.filter(s => s.userId === userId);

    // Формируем матрицу статусов по userType и status (исключая статусы отправителя сообщения)
    const statusMessageMatrix = await buildStatusMessageMatrix(tenantId, message.messageId, message.senderId);

    // Формируем reactionSet
    const reactionSet = await buildReactionSet(tenantId, message.messageId, userId);

    // Получаем метаданные сообщения
    const messageMeta = await fetchMeta('message', message.messageId);

    // Получаем информацию о топике из map
    let topic = null;
    if (message.topicId) {
      topic = topicsMap.get(message.topicId) || null;
    }

    // Формируем обогащенное сообщение с контекстом пользователя
    const contextData: any = {
      userId: userId,
      isMine: message.senderId === userId
      // statuses: null, // Статусы только для данного пользователя
      // statuses: myStatuses, // Закомментировано: всегда возвращаем null
      // myReaction: userReaction // Удалено: используйте reactionSet для получения информации о реакциях
    };

    // Добавляем userInfo если пользователь найден в User модели
    if (contextUserInfo) {
      contextData.userInfo = contextUserInfo;
    }

    const senderInfo = await getSenderInfo(tenantId, message.senderId, senderInfoCache);

    return {
      ...message,
      meta: messageMeta,
      topic: topic, // Добавляем topic в ответ
      // Контекстные данные для конкретного пользователя
      context: contextData,
      // Матрица статусов (количество пар userType-status, исключая статусы отправителя)
      statusMessageMatrix: statusMessageMatrix,
      // statuses: messageStatuses, // Закомментировано: заменено на statusMessageMatrix
      reactionSet: reactionSet,
      senderInfo: senderInfo || null
    };
  })
);

// Удаляем служебные поля
const sanitizedMessages = enrichedMessages.map(msg => sanitizeResponse(msg));

return {
  data: sanitizedMessages,
  pagination: {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit)
  }
};
}
