import {
  DialogMember, Dialog, Message,
  Meta, User,
  UserDialogStats,
  Topic,
  DialogStats
} from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import {
  parseFilters,
  extractMetaFilters,
  buildFilterQuery
} from '@chat3/utils/queryParser.js';
import {
  assertFilterNotOrWithMessage,
  buildMessageCreatedAtDistinctPipeline,
  collectMessageCreatedAtCondition,
  stripMessageFilterFromParsed
} from '@chat3/utils/userDialogMessageFilterUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { mergeMetaRecords } from '@chat3/utils/userDialogUtils.js';
import { AppServiceError, isAppServiceError } from '../errors/AppServiceError.js';

export interface ListUserDialogsInput {
  tenantId: string;
  userId: string;
  page?: number;
  limit?: number;
  filter?: string | null;
  sort?: string | null;
  /** Legacy query shorthand for unreadCount (also via filter) */
  unreadCount?: unknown;
  lastSeenAt?: unknown;
  lastMessageAt?: unknown;
  /** When false, skip lastMessage enrichment (gRPC). Default true. */
  includeLastMessage?: boolean;
}

export interface ListUserDialogsPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ListUserDialogsResult {
  data: any[];
  pagination: ListUserDialogsPagination;
}

/**
 * List dialogs for a user with filters, sort and pagination.
 * Shared by REST and gRPC.
 */
export async function listUserDialogs(input: ListUserDialogsInput): Promise<ListUserDialogsResult> {
  const {
    tenantId,
    userId,
    filter = null,
    sort = null,
    unreadCount,
    lastSeenAt,
    lastMessageAt,
    includeLastMessage = true
  } = input;

  if (!tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }
  if (!userId) {
    throw new AppServiceError('VALIDATION', 'userId is required');
  }

  const page = input.page && input.page > 0 ? input.page : 1;
  const limit = input.limit && input.limit > 0 ? input.limit : 10;

  const skip = (page - 1) * limit;
  const fetchMeta = (entityType: any, entityId: string) => metaUtils.getEntityMeta(
    tenantId,
    entityType,
    entityId
  );

let dialogIds: string[] | null = null;
let regularFilters: any = {};

// Фильтрация по метаданным
if (filter) {
  try {
    const rawParsed = parseFilters(String(filter));

    const orMsgErr = assertFilterNotOrWithMessage(rawParsed);
    if (orMsgErr) {
      throw new AppServiceError('VALIDATION', orMsgErr);
    }

    const msgCollect = collectMessageCreatedAtCondition(rawParsed);
    if (msgCollect.ok === false) {
      throw new AppServiceError('VALIDATION', msgCollect.errorMessage);
    }

    if (msgCollect.createdAt !== null) {
      const distinctRows = await Message.aggregate(
        buildMessageCreatedAtDistinctPipeline(tenantId, msgCollect.createdAt)
      );
      const distinctIds = distinctRows.map((r: { _id: string }) => r._id);
      const userMemberRows = await DialogMember.find({
        userId,
        tenantId: tenantId
      })
        .select('dialogId')
        .lean();
      const allowed = new Set(userMemberRows.map((m: any) => m.dialogId));
      const narrowed = (distinctIds as string[]).filter((id: string) => allowed.has(id));
      if (narrowed.length === 0) {
        return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
      }
      dialogIds = narrowed;
    }

    const parsedFilters = stripMessageFilterFromParsed(rawParsed);
    const extracted = extractMetaFilters(parsedFilters);

    // При $or используем buildFilterQuery (member в ветках не поддерживается)
    if ('branches' in extracted) {
      const baseQuery = await buildFilterQuery(tenantId, 'dialog', parsedFilters);
      const dialogs = await Dialog.find({ tenantId: tenantId, ...baseQuery }).select('dialogId').lean();
      const allDialogIds = dialogs.map((d: any) => d.dialogId);
      const userDialogIds = (await DialogMember.find({ userId, tenantId: tenantId }).select('dialogId').lean()).map((m: any) => m.dialogId);
      dialogIds = allDialogIds.filter((id: string) => userDialogIds.includes(id));
      regularFilters = {};
    } else {
    const { metaFilters, regularFilters: extractedRegularFilters, memberFilters } = extracted;
    regularFilters = extractedRegularFilters;
    
    // Обрабатываем meta фильтры (исключая topic.meta.*, которые обрабатываются отдельно)
    const dialogMetaFilters = Object.fromEntries(
      Object.entries(metaFilters).filter(([key]) => !key.startsWith('topic.meta.'))
    );
    
    if (Object.keys(dialogMetaFilters).length > 0) {
    const metaQuery = {
        tenantId: tenantId, // tenantId теперь строка (tnt_*)
        entityType: 'dialog'
      };

      // Проходим по всем meta фильтрам диалогов
      for (const [key, condition] of Object.entries(dialogMetaFilters)) {
        let foundDialogIds;
        
        // Обработка негативных операторов ($ne, $nin) требует специальной логики
        const conditionObj = condition as any;
        const isNegativeOperator = typeof condition === 'object' && (conditionObj.$ne !== undefined || conditionObj.$nin !== undefined);
        
        if (isNegativeOperator) {
          // Для негативных операторов:
          // 1. Получаем все dialogId с этим ключом
          const allWithKey = await Meta.find({
            ...metaQuery,
            key: key
          }).select('entityId value').lean();
          
          // 2. Фильтруем по условию
          if (conditionObj.$ne !== undefined) {
            // $ne: не равно конкретному значению
            foundDialogIds = allWithKey
              .filter(m => m.value !== conditionObj.$ne)
              .map(m => m.entityId.toString());
          } else if (conditionObj.$nin !== undefined) {
            // $nin: не в массиве значений
            foundDialogIds = allWithKey
              .filter(m => !conditionObj.$nin.includes(m.value))
              .map(m => m.entityId.toString());
          }
        } else {
          // Для позитивных операторов (eq, in, gt, etc.) используем обычный запрос
          const metaRecords = await Meta.find({
            ...metaQuery,
            key: key,
            value: condition
          }).select('entityId').lean();
          
          foundDialogIds = metaRecords.map(m => m.entityId.toString());
        }
        
        // Объединяем с предыдущими результатами (AND логика)
        if (dialogIds === null) {
          dialogIds = foundDialogIds;
        } else {
          // Пересечение (AND логика между фильтрами)
          dialogIds = dialogIds.filter(id => foundDialogIds.includes(id));
        }
      }
    }
    
    // Валидация: отклоняем старый формат (topicId,*)
    if (regularFilters.topicId !== undefined) {
      throw new AppServiceError('VALIDATION', 'Filter format (topicId,*) is deprecated. Use (topic.topicId,*) instead.');
    }
    
    // Обрабатываем фильтры по топикам (новый формат topic.topicId)
    if (regularFilters.topic && regularFilters.topic.topicId !== undefined) {
      // Находим диалоги текущего пользователя
      const userDialogs = await DialogMember.find({
        userId: userId,
        tenantId: tenantId,
      }).select('dialogId').lean();
      
      const userDialogIds = userDialogs.map(d => d.dialogId);
      
      if (userDialogIds.length === 0) {
        return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
      }
      
      const topicIdCondition = regularFilters.topic.topicId;
      let foundDialogIds = null;
      
      // Обработка различных операторов для topic.topicId
      if (typeof topicIdCondition === 'object') {
        if (topicIdCondition.$ne === null) {
          // Фильтр topic.topicId,ne,null - диалоги с любыми топиками
          const topics = await Topic.find({
            tenantId: tenantId,
            dialogId: { $in: userDialogIds }
          }).select('dialogId').lean();
          
          foundDialogIds = [...new Set(topics.map(t => t.dialogId))];
        } else if (topicIdCondition.$in) {
          // Фильтр topic.topicId,in,[topic1,topic2,...] - диалоги с любым из указанных топиков
          const topics = await Topic.find({
            tenantId: tenantId,
            topicId: { $in: topicIdCondition.$in },
            dialogId: { $in: userDialogIds }
          }).select('dialogId').lean();
          
          foundDialogIds = [...new Set(topics.map(t => t.dialogId))];
        } else if (topicIdCondition.$nin) {
          // Фильтр topic.topicId,nin,[topic1,topic2] - диалоги без указанных топиков
          const allTopics = await Topic.find({
            tenantId: tenantId,
            dialogId: { $in: userDialogIds }
          }).select('dialogId topicId').lean();
          
          // Исключаем диалоги, содержащие указанные топики
          const excludedDialogIds = new Set(
            allTopics
              .filter(t => topicIdCondition.$nin.includes(t.topicId))
              .map(t => t.dialogId)
          );
          
          foundDialogIds = [...new Set(
            allTopics
              .map(t => t.dialogId)
              .filter(dialogId => !excludedDialogIds.has(dialogId))
          )];
        } else if (topicIdCondition.$eq !== undefined) {
          // Фильтр topic.topicId,eq,{topicId} - диалог с конкретным топиком
          const topic = await Topic.findOne({
            tenantId: tenantId,
            topicId: topicIdCondition.$eq
          }).lean();
          
          if (topic && userDialogIds.includes(topic.dialogId)) {
            foundDialogIds = [topic.dialogId];
          } else {
            foundDialogIds = [];
          }
        }
      } else {
        // Простое равенство: topic.topicId,eq,{topicId}
        const topic = await Topic.findOne({
          tenantId: tenantId,
          topicId: topicIdCondition
        }).lean();
        
        if (topic && userDialogIds.includes(topic.dialogId)) {
          foundDialogIds = [topic.dialogId];
        } else {
          foundDialogIds = [];
        }
      }
      
      // Объединяем с предыдущими результатами (AND логика)
      if (foundDialogIds !== null) {
        if (dialogIds !== null) {
          dialogIds = dialogIds.filter(id => foundDialogIds.includes(id));
        } else {
          dialogIds = foundDialogIds;
        }
      }
      
      // Удаляем из regularFilters
      delete regularFilters.topic;
    }
    
    // Фильтр topic.meta.{param} - диалоги, содержащие топики с указанным мета-тегом
    const topicMetaFilters = Object.keys(metaFilters).filter(key => key.startsWith('topic.meta.'));
    if (topicMetaFilters.length > 0) {
      // Находим диалоги текущего пользователя
      const userDialogs = await DialogMember.find({
        userId: userId,
        tenantId: tenantId,
      }).select('dialogId').lean();
      
      const userDialogIds = userDialogs.map(d => d.dialogId);
      
      if (userDialogIds.length === 0) {
        return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
      }
      
      let foundDialogIds = null;
      
      for (const metaKey of topicMetaFilters) {
        // Извлекаем параметр из topic.meta.{param}
        const param = metaKey.replace('topic.meta.', '');
        const condition = metaFilters[metaKey];
        
        let topicIds = [];
        
        // Обработка различных операторов для мета-тегов
        if (typeof condition === 'object') {
          const conditionObj = condition as any;
          if (conditionObj.$ne !== undefined) {
            // Фильтр topic.meta.{key},ne,{value} - топики с мета-тегом, но не равным значению
            const allMetaRecords = await Meta.find({
              tenantId: tenantId,
              entityType: 'topic',
              key: param
            }).select('entityId value').lean();
            
            topicIds = allMetaRecords
              .filter(m => m.value !== conditionObj.$ne)
              .map(m => m.entityId);
          } else if (conditionObj.$in) {
            // Фильтр topic.meta.{key},in,[value1,value2] - топики с мета-тегом, значение которого в списке
            const metaRecords = await Meta.find({
              tenantId: tenantId,
              entityType: 'topic',
              key: param,
              value: { $in: conditionObj.$in }
            }).select('entityId').lean();
            
            topicIds = metaRecords.map(m => m.entityId);
          } else if (conditionObj.$nin) {
            // Фильтр topic.meta.{key},nin,[value1,value2] - топики с мета-тегом, значение которого НЕ в списке
            const allMetaRecords = await Meta.find({
              tenantId: tenantId,
              entityType: 'topic',
              key: param
            }).select('entityId value').lean();
            
            topicIds = allMetaRecords
              .filter(m => !conditionObj.$nin.includes(m.value))
              .map(m => m.entityId);
          } else if (conditionObj.$exists !== undefined) {
            // Фильтр topic.meta.{key},exists,true/false - проверка наличия мета-тега
            if (conditionObj.$exists === true) {
              // Находим топики, имеющие мета-тег (любое значение)
              const metaRecords = await Meta.find({
                tenantId: tenantId,
                entityType: 'topic',
                key: param
              }).select('entityId').lean();
              
              topicIds = metaRecords.map(m => m.entityId);
            } else {
              // Находим топики, НЕ имеющие мета-тег
              // Получаем все топики в диалогах пользователя
              const allTopics = await Topic.find({
                tenantId: tenantId,
                dialogId: { $in: userDialogIds }
              }).select('topicId').lean();
              
              const allTopicIds = allTopics.map(t => t.topicId);
              
              // Получаем топики с мета-тегом
              const topicsWithMeta = await Meta.find({
                tenantId: tenantId,
                entityType: 'topic',
                key: param
              }).select('entityId').lean();
              
              const topicIdsWithMeta = new Set(topicsWithMeta.map(m => m.entityId));
              
              // Исключаем топики с мета-тегом
              topicIds = allTopicIds.filter(id => !topicIdsWithMeta.has(id));
            }
          } else if (conditionObj.$eq !== undefined) {
            // Фильтр topic.meta.{key},eq,{value} - точное равенство (через $eq)
            const metaRecords = await Meta.find({
              tenantId: tenantId,
              entityType: 'topic',
              key: param,
              value: conditionObj.$eq
            }).select('entityId').lean();
            
            topicIds = metaRecords.map(m => m.entityId);
          } else {
            // Для других операторов используем как есть
            const metaRecords = await Meta.find({
              tenantId: tenantId,
              entityType: 'topic',
              key: param,
              value: condition
            }).select('entityId').lean();
            
            topicIds = metaRecords.map(m => m.entityId);
          }
        } else {
          // Простое равенство: topic.meta.{key},eq,{value}
          const metaRecords = await Meta.find({
            tenantId: tenantId,
            entityType: 'topic',
            key: param,
            value: condition
          }).select('entityId').lean();
          
          topicIds = metaRecords.map(m => m.entityId);
        }
        
        if (topicIds.length === 0) {
          foundDialogIds = [];
          break;
        }
        
        // Находим диалоги, содержащие эти топики
        const topics = await Topic.find({
          tenantId: tenantId,
          topicId: { $in: topicIds },
          dialogId: { $in: userDialogIds }
        }).select('dialogId').lean();
        
        const dialogIdsWithTopic = [...new Set(topics.map(t => t.dialogId))];
        
        // Объединяем с предыдущими результатами (AND логика)
        if (foundDialogIds === null) {
          foundDialogIds = dialogIdsWithTopic;
        } else {
          foundDialogIds = foundDialogIds.filter(id => dialogIdsWithTopic.includes(id));
        }
        
        // Удаляем из metaFilters, чтобы не обрабатывать повторно
        delete metaFilters[metaKey];
      }
      
      if (foundDialogIds !== null) {
        // Если уже есть фильтр по meta, пересекаем результаты (AND логика)
        if (dialogIds !== null) {
          dialogIds = dialogIds.filter(id => foundDialogIds.includes(id));
        } else {
          dialogIds = foundDialogIds;
        }
      }
    }
    
    // Фильтр topic.topicCount - фильтрация по количеству топиков в диалоге
    if (regularFilters.topic && regularFilters.topic.topicCount !== undefined) {
      // Находим диалоги текущего пользователя
      const userDialogs = await DialogMember.find({
        userId: userId,
        tenantId: tenantId,
      }).select('dialogId').lean();
      
      const userDialogIds = userDialogs.map(d => d.dialogId);
      
      if (userDialogIds.length === 0) {
        return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
      }
      
      // Загружаем DialogStats для всех диалогов пользователя
      const dialogStats = await DialogStats.find({
        tenantId: tenantId,
        dialogId: { $in: userDialogIds }
      }).select('dialogId topicCount').lean();
      
      const topicCountCondition = regularFilters.topic.topicCount;
      let foundDialogIds = [];
      
      // Применяем фильтр по topicCount с указанным оператором
      for (const stat of dialogStats) {
        const topicCount = stat.topicCount || 0;
        let matches = false;
        
        if (typeof topicCountCondition === 'object') {
          if (topicCountCondition.$gt !== undefined) {
            matches = topicCount > topicCountCondition.$gt;
          } else if (topicCountCondition.$gte !== undefined) {
            matches = topicCount >= topicCountCondition.$gte;
          } else if (topicCountCondition.$lt !== undefined) {
            matches = topicCount < topicCountCondition.$lt;
          } else if (topicCountCondition.$lte !== undefined) {
            matches = topicCount <= topicCountCondition.$lte;
          } else if (topicCountCondition.$in) {
            matches = topicCountCondition.$in.includes(topicCount);
          } else if (topicCountCondition.$ne !== undefined) {
            matches = topicCount !== topicCountCondition.$ne;
          } else if (topicCountCondition.$eq !== undefined) {
            matches = topicCount === topicCountCondition.$eq;
          }
        } else {
          // Простое равенство
          matches = topicCount === topicCountCondition;
        }
        
        if (matches) {
          foundDialogIds.push(stat.dialogId);
        }
      }
      
      // Объединяем с предыдущими результатами (AND логика)
      if (dialogIds !== null) {
        dialogIds = dialogIds.filter(id => foundDialogIds.includes(id));
      } else {
        dialogIds = foundDialogIds;
      }
      
      // Удаляем из regularFilters
      delete regularFilters.topic;
    }
    
    // Обрабатываем member фильтры (фильтрация по участникам)
    // Важно: нужно найти диалоги где есть И текущий пользователь, И указанные участники
    if (Object.keys(memberFilters).length > 0) {
      // Для фильтрации по участникам используем специальную логику:
      // находим диалоги где есть текущий пользователь И указанные участники
      // DialogMember уже импортирован в начале файла
      
      // Получаем список указанных участников из фильтра
      let targetUserIds: string[] = [];
      if (memberFilters.member) {
        const memberValue = memberFilters.member;
        if (typeof memberValue === 'string') {
          // Один участник - обрабатываем как $in с одним элементом
          targetUserIds = [memberValue];
          
          // Находим диалоги текущего пользователя
          const userDialogs = await DialogMember.find({
            userId: userId,
            tenantId: tenantId,
          }).select('dialogId').lean();
          
          const userDialogIds = userDialogs.map(d => d.dialogId);
          
          if (userDialogIds.length === 0) {
            return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
          }
          
          // Находим диалоги где есть указанный участник (но только из диалогов текущего пользователя)
          const targetDialogs = await DialogMember.find({
            userId: memberValue,
            dialogId: { $in: userDialogIds },
            tenantId: tenantId
          }).select('dialogId').lean();
          
          const memberDialogIds = targetDialogs.map(d => d.dialogId);
          
          console.log('Member filter (single) applied, found dialogs:', memberDialogIds.length, 'with member:', memberValue);
          
          if (memberDialogIds.length === 0) {
            return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
          }
          
          // Если уже есть фильтр по meta, пересекаем результаты (AND логика)
          if (dialogIds !== null) {
            dialogIds = dialogIds.filter(id => memberDialogIds.includes(id));
          } else {
            dialogIds = memberDialogIds;
          }
        } else if (typeof memberValue === 'object' && (memberValue as any).$in) {
          // Для $in: находим диалоги где есть ЛЮБОЙ из указанных участников (OR логика)
          targetUserIds = (memberValue as any).$in;
          
          // Находим диалоги текущего пользователя
          const userDialogs = await DialogMember.find({
            userId: userId,
            tenantId: tenantId,
          }).select('dialogId').lean();
          
          const userDialogIds = userDialogs.map(d => d.dialogId);
          
          if (userDialogIds.length === 0) {
            return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
          }
          
          // Находим диалоги где есть ЛЮБОЙ из указанных участников (но только из диалогов текущего пользователя)
          const targetDialogs = await DialogMember.find({
            userId: { $in: targetUserIds },
            dialogId: { $in: userDialogIds },
            tenantId: tenantId,
          }).select('dialogId').lean();
          
          // Получаем уникальные dialogId
          const memberDialogIds = [...new Set(targetDialogs.map(d => d.dialogId))];
          
          console.log('Member filter ($in) applied:');
          console.log('  - Target user IDs:', targetUserIds);
          console.log('  - User dialog IDs:', userDialogIds.length);
          console.log('  - Target dialogs found:', targetDialogs.length);
          console.log('  - Unique dialog IDs:', memberDialogIds.length);
          console.log('  - Dialog IDs:', memberDialogIds);
          
          if (memberDialogIds.length === 0) {
            return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
          }
          
          // Если уже есть фильтр по meta, пересекаем результаты (AND логика)
          if (dialogIds !== null) {
            dialogIds = dialogIds.filter(id => memberDialogIds.includes(id));
          } else {
            dialogIds = memberDialogIds;
          }
        } else if (typeof memberValue === 'object' && (memberValue as any).$all) {
          // Для $all: находим диалоги где есть ВСЕ указанные участники (AND логика)
          targetUserIds = (memberValue as any).$all;
          
          // Находим диалоги текущего пользователя
          const userDialogs = await DialogMember.find({
            userId: userId,
            tenantId: tenantId,
          }).select('dialogId').lean();
          
          const userDialogIds = userDialogs.map(d => d.dialogId);
          
          if (userDialogIds.length === 0) {
            return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
          }
          
          // Находим все участники для указанных пользователей в диалогах текущего пользователя
          const allTargetMembers = await DialogMember.find({
            userId: { $in: targetUserIds },
            dialogId: { $in: userDialogIds },
            tenantId: tenantId,
          }).select('dialogId userId').lean();
          
          // Группируем по dialogId
          const dialogMembersMap: Record<string, Set<string>> = {};
          allTargetMembers.forEach(dm => {
            if (!dialogMembersMap[dm.dialogId]) {
              dialogMembersMap[dm.dialogId] = new Set();
            }
            dialogMembersMap[dm.dialogId].add(dm.userId);
          });
          
          // Находим диалоги где присутствуют ВСЕ указанные участники
          const memberDialogIds: string[] = [];
          for (const dialogId of userDialogIds) {
            const members = dialogMembersMap[dialogId] || new Set();
            // Проверяем, что все указанные участники присутствуют в диалоге
            const hasAllMembers = targetUserIds.every(targetUserId => members.has(targetUserId));
            if (hasAllMembers) {
              memberDialogIds.push(dialogId);
            }
          }
          
          console.log('Member filter ($all) applied, found dialogs:', memberDialogIds.length, 'with all members:', targetUserIds);
          
          if (memberDialogIds.length === 0) {
            return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
          }
          
          // Если уже есть фильтр по meta, пересекаем результаты (AND логика)
          if (dialogIds !== null) {
            dialogIds = dialogIds.filter(id => memberDialogIds.includes(id));
          } else {
            dialogIds = memberDialogIds;
          }
        } else if (typeof memberValue === 'object' && (memberValue as any).$ne) {
          // Для $ne: находим диалоги где НЕТ указанного участника (исключение участника)
          const excludedUserId = (memberValue as any).$ne;
          
          // Находим диалоги текущего пользователя
          const userDialogs = await DialogMember.find({
            userId: userId,
            tenantId: tenantId,
          }).select('dialogId').lean();
          
          const userDialogIds = userDialogs.map(d => d.dialogId);
          
          if (userDialogIds.length === 0) {
            return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
          }
          
          // Находим диалоги где есть исключаемый участник
          const dialogsWithExcluded = await DialogMember.find({
            userId: excludedUserId,
            dialogId: { $in: userDialogIds },
            tenantId: tenantId,
          }).select('dialogId').lean();
          
          const excludedDialogIds = new Set(dialogsWithExcluded.map(d => d.dialogId));
          
          // Исключаем эти диалоги из списка
          const memberDialogIds = userDialogIds.filter(dialogId => !excludedDialogIds.has(dialogId));
          
          console.log('Member filter ($ne) applied, found dialogs:', memberDialogIds.length, 'excluding member:', excludedUserId);
          
          if (memberDialogIds.length === 0) {
            return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
          }
          
          // Если уже есть фильтр по meta, пересекаем результаты (AND логика)
          if (dialogIds !== null) {
            dialogIds = dialogIds.filter(id => memberDialogIds.includes(id));
          } else {
            dialogIds = memberDialogIds;
          }
        } else if (typeof memberValue === 'object' && (memberValue as any).$nin) {
          // Для $nin: находим диалоги где НЕТ ни одного из указанных участников
          const excludedUserIds = Array.isArray((memberValue as any).$nin) ? (memberValue as any).$nin : [(memberValue as any).$nin];
          
          // Находим диалоги текущего пользователя
          const userDialogs = await DialogMember.find({
            userId: userId,
            tenantId: tenantId,
          }).select('dialogId').lean();
          
          const userDialogIds = userDialogs.map(d => d.dialogId);
          
          if (userDialogIds.length === 0) {
            return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
          }
          
          // Находим диалоги где есть хотя бы один из исключаемых участников
          const dialogsWithExcluded = await DialogMember.find({
            userId: { $in: excludedUserIds },
            dialogId: { $in: userDialogIds },
            tenantId: tenantId,
          }).select('dialogId').lean();
          
          const excludedDialogIds = new Set(dialogsWithExcluded.map(d => d.dialogId));
          
          // Исключаем эти диалоги из списка
          const memberDialogIds = userDialogIds.filter(dialogId => !excludedDialogIds.has(dialogId));
          
          console.log('Member filter ($nin) applied, found dialogs:', memberDialogIds.length, 'excluding members:', excludedUserIds);
          
          if (memberDialogIds.length === 0) {
            return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
          }
          
          // Если уже есть фильтр по meta, пересекаем результаты (AND логика)
          if (dialogIds !== null) {
            dialogIds = dialogIds.filter(id => memberDialogIds.includes(id));
          } else {
            dialogIds = memberDialogIds;
          }
        }
      }
    }
    }
    
  } catch (error: any) {
    if (isAppServiceError(error)) {
      throw error;
    }
    throw new AppServiceError('VALIDATION', `Invalid filter format. ${error.message}. Examples: {"meta":{"key":"value"}} or (meta.key,eq,value) or (meta.key,ne,value)&(meta.key2,in,[val1,val2])`);
  }
}

// Get user's dialog memberships
const dialogMembersQuery: any = {
  userId: userId,
  tenantId: tenantId
};

// Применяем обычные фильтры (например, dialogId) к dialogMembersQuery
// Но если есть dialogId в regularFilters, обрабатываем его отдельно
const { dialogId: regularDialogId, ...otherRegularFilters } = regularFilters;

// Применяем другие regularFilters к dialogMembersQuery
// lastSeenAt и lastMessageAt теперь в UserDialogActivity, обрабатываем отдельно
// unreadCount теперь в UserDialogStats, обрабатываем отдельно
if (Object.keys(otherRegularFilters).length > 0) {
  // Применяем фильтры для полей DialogMember (кроме unreadCount, lastSeenAt, lastMessageAt)
  const excludedFields = ['unreadCount', 'lastSeenAt', 'lastMessageAt', 'message'];
  for (const [field, condition] of Object.entries(otherRegularFilters)) {
    if (!excludedFields.includes(field)) {
      dialogMembersQuery[field] = condition;
      console.log(`Applied regular filter ${field}:`, condition);
    }
  }
}

// Обрабатываем фильтр по unreadCount отдельно (из UserDialogStats)
// Сначала получаем dialogIds с нужным unreadCount, затем фильтруем dialogMembers
let unreadCountFilter = null;
if (unreadCount !== undefined || otherRegularFilters.unreadCount !== undefined) {
  const unreadCountValue = unreadCount !== undefined 
    ? unreadCount 
    : otherRegularFilters.unreadCount;
  
  console.log('unreadCount:', unreadCountValue, 'type:', typeof unreadCountValue);
  
  // Поддержка операторов для unreadCount
  if (typeof unreadCountValue === 'object' && unreadCountValue !== null) {
    // Объект с операторами MongoDB ($gte, $gt, $lte, $lt)
    unreadCountFilter = unreadCountValue;
  } else if (typeof unreadCountValue === 'string') {
    // Строка с префиксом оператора
    if (unreadCountValue.startsWith('gte:')) {
      const value = parseInt(unreadCountValue.substring(4));
      if (!isNaN(value)) {
        unreadCountFilter = { $gte: value };
      }
    } else if (unreadCountValue.startsWith('gt:')) {
      const value = parseInt(unreadCountValue.substring(3));
      if (!isNaN(value)) {
        unreadCountFilter = { $gt: value };
      }
    } else if (unreadCountValue.startsWith('lte:')) {
      const value = parseInt(unreadCountValue.substring(4));
      if (!isNaN(value)) {
        unreadCountFilter = { $lte: value };
      }
    } else if (unreadCountValue.startsWith('lt:')) {
      const value = parseInt(unreadCountValue.substring(3));
      if (!isNaN(value)) {
        unreadCountFilter = { $lt: value };
      }
    } else {
      // Точное равенство (eq)
      const unreadCount = parseInt(unreadCountValue);
      if (!isNaN(unreadCount)) {
        unreadCountFilter = unreadCount;
      }
    }
  } else {
    // Число - точное равенство
    const unreadCount = parseInt(unreadCountValue);
    if (!isNaN(unreadCount)) {
      unreadCountFilter = unreadCount;
    }
  }
  console.log('unreadCount filter:', unreadCountFilter);
}

// Фильтры по lastSeenAt и lastMessageAt обрабатываются через UserDialogActivity
let activityFilter = null;
if (lastSeenAt !== undefined || otherRegularFilters.lastSeenAt !== undefined) {
  const lastSeenAtValue = lastSeenAt !== undefined 
    ? lastSeenAt 
    : otherRegularFilters.lastSeenAt;
  
  if (!activityFilter) activityFilter = {};
  
  // Поддержка операторов для lastSeenAt
  if (typeof lastSeenAtValue === 'string') {
    if (lastSeenAtValue.startsWith('gt:')) {
      activityFilter.lastSeenAt = { $gt: parseInt(lastSeenAtValue.substring(3)) };
    } else if (lastSeenAtValue.startsWith('gte:')) {
      activityFilter.lastSeenAt = { $gte: parseInt(lastSeenAtValue.substring(4)) };
    } else if (lastSeenAtValue.startsWith('lt:')) {
      activityFilter.lastSeenAt = { $lt: parseInt(lastSeenAtValue.substring(3)) };
    } else if (lastSeenAtValue.startsWith('lte:')) {
      activityFilter.lastSeenAt = { $lte: parseInt(lastSeenAtValue.substring(4)) };
    } else {
      activityFilter.lastSeenAt = parseInt(lastSeenAtValue);
    }
  } else if (typeof lastSeenAtValue === 'object' && lastSeenAtValue !== null) {
    activityFilter.lastSeenAt = lastSeenAtValue;
  } else {
    activityFilter.lastSeenAt = lastSeenAtValue;
  }
  console.log('Applied lastSeenAt filter to activity:', activityFilter.lastSeenAt);
}

if (lastMessageAt !== undefined || otherRegularFilters.lastMessageAt !== undefined) {
  const lastMessageAtValue = lastMessageAt !== undefined 
    ? lastMessageAt 
    : otherRegularFilters.lastMessageAt;
  
  if (!activityFilter) activityFilter = {};
  
  // Поддержка операторов для lastMessageAt
  if (typeof lastMessageAtValue === 'string') {
    if (lastMessageAtValue.startsWith('gt:')) {
      activityFilter.lastMessageAt = { $gt: parseInt(lastMessageAtValue.substring(3)) };
    } else if (lastMessageAtValue.startsWith('gte:')) {
      activityFilter.lastMessageAt = { $gte: parseInt(lastMessageAtValue.substring(4)) };
    } else if (lastMessageAtValue.startsWith('lt:')) {
      activityFilter.lastMessageAt = { $lt: parseInt(lastMessageAtValue.substring(3)) };
    } else if (lastMessageAtValue.startsWith('lte:')) {
      activityFilter.lastMessageAt = { $lte: parseInt(lastMessageAtValue.substring(4)) };
    } else {
      activityFilter.lastMessageAt = parseInt(lastMessageAtValue);
    }
  } else if (typeof lastMessageAtValue === 'object' && lastMessageAtValue !== null) {
    activityFilter.lastMessageAt = lastMessageAtValue;
  } else {
    activityFilter.lastMessageAt = lastMessageAtValue;
  }
  console.log('Applied lastMessageAt filter to activity:', activityFilter.lastMessageAt);
}

// Если есть фильтрация по meta или по участникам, ограничиваем выборку
if (dialogIds !== null) {
  if (dialogIds.length === 0) {
    // Нет диалогов с такими фильтрами
    console.log('No dialogs found after filtering, returning empty result');
    return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
  }
  
  // Если также есть regularFilters.dialogId, делаем пересечение
  if (regularDialogId !== undefined) {
    // Преобразуем regularDialogId в массив для сравнения
    const regularDialogIdArray = Array.isArray(regularDialogId) ? regularDialogId : [regularDialogId];
    // Пересечение: оставляем только те dialogIds, которые есть и в dialogIds, и в regularDialogId
    dialogIds = dialogIds.filter(id => regularDialogIdArray.includes(id));
    
    if (dialogIds.length === 0) {
      // Нет диалогов, удовлетворяющих обоим условиям
      return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
    }
  }
  
  console.log('Applying dialogIds filter:', dialogIds.length, 'dialogs');
  dialogMembersQuery.dialogId = { $in: dialogIds };
} else if (regularDialogId !== undefined) {
  // Если нет dialogIds из meta/member фильтров, но есть regularDialogId
  const regularDialogIdArray = Array.isArray(regularDialogId) ? regularDialogId : [regularDialogId];
  dialogMembersQuery.dialogId = regularDialogIdArray.length === 1 ? regularDialogIdArray[0] : { $in: regularDialogIdArray };
}

console.log('Final dialogMembersQuery:', JSON.stringify(dialogMembersQuery, null, 2));

// Используем aggregation для получения DialogMember с данными из UserDialogActivity
const aggregationPipeline: any[] = [
  { $match: dialogMembersQuery },
  {
    $lookup: {
      from: 'userdialogactivities',
      let: { memberUserId: '$userId', memberDialogId: '$dialogId' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ['$tenantId', tenantId] },
                { $eq: ['$userId', '$$memberUserId'] },
                { $eq: ['$dialogId', '$$memberDialogId'] }
              ]
            }
          }
        }
      ],
      as: 'activity'
    }
  },
  {
    $unwind: {
      path: '$activity',
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $addFields: {
      lastSeenAt: { $ifNull: ['$activity.lastSeenAt', 0] },
      lastMessageAt: { $ifNull: ['$activity.lastMessageAt', 0] }
    }
  }
];

// Если есть фильтр по активности, добавляем его после lookup
if (activityFilter !== null) {
  const activityMatch: any = {
    $or: []
  };
  
  if (activityFilter.lastSeenAt) {
    activityMatch.$or.push({ 'activity.lastSeenAt': activityFilter.lastSeenAt });
  }
  if (activityFilter.lastMessageAt) {
    activityMatch.$or.push({ 'activity.lastMessageAt': activityFilter.lastMessageAt });
  }
  
  if (activityMatch.$or.length > 0) {
    aggregationPipeline.push({ $match: activityMatch });
  }
}

// Сортировка по lastSeenAt (из activity)
aggregationPipeline.push({ $sort: { lastSeenAt: -1 } });

let dialogMembers = await DialogMember.aggregate(aggregationPipeline);

console.log('Found dialogMembers:', dialogMembers.length);

// Если есть фильтр по unreadCount, применяем его через UserDialogStats
if (unreadCountFilter !== null) {
  const unreadCountQuery: any = {
    tenantId: tenantId,
    userId: userId,
    dialogId: { $in: dialogMembers.map(m => m.dialogId) }
  };
  
  if (typeof unreadCountFilter === 'object') {
    unreadCountQuery.unreadCount = unreadCountFilter;
  } else {
    unreadCountQuery.unreadCount = unreadCountFilter;
  }
  
  const userDialogStats = await UserDialogStats.find(unreadCountQuery)
    .select('dialogId unreadCount')
    .lean();
  
  const allowedDialogIds = new Set(userDialogStats.map(s => s.dialogId));
  dialogMembers = dialogMembers.filter(m => allowedDialogIds.has(m.dialogId));
  console.log('After unreadCount filter:', dialogMembers.length, 'dialogs');
}

// Получаем уникальные dialogId
const uniqueDialogIds = [...new Set(dialogMembers.map(m => m.dialogId))];

console.log('Unique dialog IDs from dialogMembers:', uniqueDialogIds.length, uniqueDialogIds);

// Если был применен фильтр по участникам, дополнительно проверяем, что в каждом диалоге действительно есть нужные участники
if (dialogIds !== null && filter) {
  try {
    const parsedFiltersForMember = stripMessageFilterFromParsed(
      parseFilters(String(filter))
    );
    const extracted = extractMetaFilters(parsedFiltersForMember);
    if ('branches' in extracted) {
      // При $or member не поддерживается — проверку пропускаем
    } else {
    const { memberFilters } = extracted;
    
    if (Object.keys(memberFilters).length > 0 && memberFilters.member) {
      const memberValue = memberFilters.member;
      let requiredUserIds = [];
      
      if (typeof memberValue === 'string') {
        requiredUserIds = [memberValue];
      } else if (typeof memberValue === 'object' && (memberValue as any).$in) {
        requiredUserIds = (memberValue as any).$in;
      } else if (typeof memberValue === 'object' && (memberValue as any).$all) {
        requiredUserIds = (memberValue as any).$all;
      }
      
    if (requiredUserIds.length > 0) {
      // Проверяем, что в каждом диалоге есть нужные участники
      const verifiedMembers = await DialogMember.find({
        dialogId: { $in: uniqueDialogIds },
        userId: { $in: requiredUserIds },
        tenantId: tenantId
      }).select('dialogId userId').lean();
      
      const dialogsWithRequiredMembers = new Set(verifiedMembers.map(m => m.dialogId));
      
      // Фильтруем только те диалоги, где действительно есть нужные участники
      const verifiedDialogIds = uniqueDialogIds.filter(dialogId => dialogsWithRequiredMembers.has(dialogId));
      
      console.log('Verified dialog IDs with required members:', verifiedDialogIds.length, 'required:', requiredUserIds);
      
      if (verifiedDialogIds.length !== uniqueDialogIds.length) {
        console.warn('Some dialogs were filtered out after verification:', uniqueDialogIds.length, '->', verifiedDialogIds.length);
      }
      
      // Используем только проверенные диалоги
      uniqueDialogIds.length = 0;
      uniqueDialogIds.push(...verifiedDialogIds);
      
      // Также фильтруем dialogMembers, чтобы оставить только проверенные диалоги
      const verifiedDialogIdsSet = new Set(verifiedDialogIds);
      dialogMembers = dialogMembers.filter(m => verifiedDialogIdsSet.has(m.dialogId));
    }
  }
    }
} catch (error: any) {
  console.error('Error verifying member filter:', error);
}
}

// Загружаем все диалоги одним запросом
const dialogsData = await Dialog.find({
  dialogId: { $in: uniqueDialogIds },
  tenantId: tenantId
}).select('dialogId name createdAt _id').lean();

// Создаем Map для быстрого поиска
const dialogsMap = new Map(dialogsData.map(d => [d.dialogId, d]));

// Загружаем всех участников для этих диалогов одним запросом (для подсчета)
const allMembers = await DialogMember.find({
  dialogId: { $in: uniqueDialogIds },
  tenantId: tenantId,
}).select('dialogId').lean();

// Подсчитываем количество участников по dialogId
const membersCountByDialog: Record<string, number> = {};
allMembers.forEach(member => {
  if (!membersCountByDialog[member.dialogId]) {
    membersCountByDialog[member.dialogId] = 0;
  }
  membersCountByDialog[member.dialogId]++;
});

// Загружаем unreadCount из UserDialogStats для всех диалогов
const memberDialogIds = dialogMembers.map(m => m.dialogId);
const userDialogStatsMap = new Map();
if (memberDialogIds.length > 0) {
  const userDialogStats = await UserDialogStats.find({
    tenantId: tenantId,
    userId: userId,
    dialogId: { $in: memberDialogIds }
  }).select('dialogId unreadCount').lean();
  
  userDialogStats.forEach(stat => {
    userDialogStatsMap.set(stat.dialogId, stat.unreadCount || 0);
  });
}

// Format response data
type DialogRow = { dialogId: string; _id: unknown };
const dialogs = dialogMembers
  .map(member => {
    const dialog = dialogsMap.get(member.dialogId) as DialogRow | undefined;
    if (!dialog) {
      console.warn(`Dialog not found for dialogId: ${member.dialogId}`);
      return null;
    }
    
    // Получаем unreadCount из UserDialogStats (или 0, если записи нет)
    const unreadCount = userDialogStatsMap.get(member.dialogId) || 0;
    
    return {
      dialogId: dialog.dialogId,
      dialogObjectId: dialog._id, // Сохраняем ObjectId для поиска сообщений
      // Context - данные текущего пользователя в этом диалоге
      context: {
        userId: userId,
        unreadCount: unreadCount, // Используем значение из UserDialogStats
        lastSeenAt: member.lastSeenAt,
        lastMessageAt: member.lastMessageAt,
        joinedAt: member.createdAt
      },
      // Members count - количество участников диалога
      membersCount: membersCountByDialog[member.dialogId] || 0,
      // Calculate last interaction time (most recent of lastSeenAt or lastMessageAt)
      // Возвращаем как число с микросекундами, а не Date объект
      lastInteractionAt: Math.max(
        member.lastSeenAt || 0,
        member.lastMessageAt || 0
      )
    };
  })
  .filter(d => d !== null); // Убираем null значения

// Apply sorting BEFORE pagination
if (sort) {
  // Parse sort parameter in format (field,direction)
  const sortMatch = String(sort).match(/\(([^,]+),([^)]+)\)/);
  if (sortMatch) {
    const field = sortMatch[1];
    const direction = sortMatch[2];
    console.log('Sorting by:', field, direction);
  
    dialogs.sort((a, b) => {
      let aVal, bVal;
      
      if (field === 'lastSeenAt') {
        aVal = a.context.lastSeenAt || 0;
        bVal = b.context.lastSeenAt || 0;
      } else if (field === 'lastInteractionAt') {
        aVal = a.lastInteractionAt || 0;
        bVal = b.lastInteractionAt || 0;
      } else if (field === 'unreadCount') {
        // unreadCount уже загружен из UserDialogStats в context
        aVal = a.context.unreadCount || 0;
        bVal = b.context.unreadCount || 0;
      } else {
        // Default sorting by lastInteractionAt
        aVal = a.lastInteractionAt || 0;
        bVal = b.lastInteractionAt || 0;
      }
      
      if (direction === 'desc') {
        return bVal - aVal;
      } else {
        return aVal - bVal;
      }
    });
  } else {
    console.log('Invalid sort format:', sort);
    // Fallback to default sorting
    dialogs.sort((a, b) => (b.lastInteractionAt || 0) - (a.lastInteractionAt || 0));
  }
} else {
  // Sort by last interaction time (most recent first) - default
  dialogs.sort((a, b) => (b.lastInteractionAt || 0) - (a.lastInteractionAt || 0));
}

// Get total count for pagination (after sorting)
const total = dialogs.length;

// Apply pagination to the sorted results
const paginatedDialogs = dialogs.slice(skip, skip + limit);

// Загружаем последние сообщения для всех диалогов
const lastMessagesMap = new Map<string, any>();
const sendersMap = new Map<string, any>();

if (includeLastMessage) {
  const lastMessages = await Promise.all(
    paginatedDialogs.map(async (dialog) => {
      const lastMsg = await Message.findOne({
        dialogId: dialog.dialogId, // Используем dialogId (строку dlg_*), а не ObjectId
        tenantId: tenantId
      })
        .sort({ createdAt: -1 })
        .select('messageId content senderId type createdAt deleted deletedAt deletedBy')
        .lean();

      return { dialogId: dialog.dialogId, message: lastMsg };
    })
  );

  lastMessages.forEach(item => {
    if (item.message) {
      lastMessagesMap.set(item.dialogId, item.message);
    }
  });

  // Получаем уникальные senderId из последних сообщений
  const senderIds = [...new Set(
    Array.from(lastMessagesMap.values())
      .map(msg => msg.senderId)
      .filter(Boolean)
  )];

  // Загружаем информацию об отправителях
  const sendersData = await User.find({
    userId: { $in: senderIds },
    tenantId: tenantId
  }).select('userId name').lean();

  // Загружаем meta для отправителей (для всех senderIds, даже если пользователя нет в User)
  const sendersMetaQuery = {
    tenantId: tenantId,
    entityType: 'user',
    entityId: { $in: senderIds }
  };

  const sendersMetaRecords = await Meta.find(sendersMetaQuery).lean();
  const groupedSenderMeta: Record<string, any[]> = {};
  sendersMetaRecords.forEach((record) => {
    if (!groupedSenderMeta[record.entityId]) {
      groupedSenderMeta[record.entityId] = [];
    }
    groupedSenderMeta[record.entityId].push(record);
  });
  const metaBySender: Record<string, any> = {};
  Object.entries(groupedSenderMeta).forEach(([entityId, records]) => {
    metaBySender[entityId] = mergeMetaRecords(records);
  });

  // 1. Добавляем пользователей, которые есть в User модели
  sendersData.forEach(user => {
    sendersMap.set(user.userId, {
      userId: user.userId,
      meta: metaBySender[user.userId] || {}
    });
  });

  // 2. Добавляем пользователей, которых нет в User, но есть meta теги
  // Fallback: если пользователь не существует в Chat3 API, используем getMeta для получения данных
  senderIds.forEach(senderId => {
    if (!sendersMap.has(senderId) && metaBySender[senderId]) {
      // Пользователь не существует в User модели, но есть meta теги
      // Создаем userInfo только на основе meta (без name, так как его нет)
      sendersMap.set(senderId, {
        userId: senderId,
        name: null, // Имя отсутствует, так как пользователя нет в User
        meta: metaBySender[senderId]
      });
    }
  });
}

// Получаем DialogStats для всех диалогов одним запросом
const dialogIdsForStats = paginatedDialogs.map(d => d.dialogId);
const dialogStatsMap = new Map();
if (dialogIdsForStats.length > 0) {
  const dialogStats = await DialogStats.find({
    tenantId: tenantId,
    dialogId: { $in: dialogIdsForStats }
  }).lean();

  dialogStats.forEach(stat => {
    dialogStatsMap.set(stat.dialogId, {
      topicCount: stat.topicCount || 0,
      memberCount: stat.memberCount || 0,
      messageCount: stat.messageCount || 0
    });
  });
}

// Get meta for each dialog and build final response
let finalDialogs = await Promise.all(
  paginatedDialogs.map(async (dialog) => {
    // Получаем meta теги для диалога
    const dialogMeta = await fetchMeta('dialog', dialog.dialogId);

    // Получаем последнее сообщение
    const lastMsg = lastMessagesMap.get(dialog.dialogId);
    let lastMessage = null;

    if (lastMsg) {
      lastMessage = {
        messageId: lastMsg.messageId,
        content: lastMsg.content,
        senderId: lastMsg.senderId,
        type: lastMsg.type,
        createdAt: lastMsg.createdAt,
        deleted: lastMsg.deleted === true,
        deletedAt: lastMsg.deletedAt ?? null,
        deletedBy: lastMsg.deletedBy ?? null
      };

      // Добавляем senderInfo если отправитель найден
      const senderInfo = sendersMap.get(lastMsg.senderId);
      if (senderInfo) {
        lastMessage.senderInfo = senderInfo;
      }
    }

    // Получаем stats для диалога
    const stats = dialogStatsMap.get(dialog.dialogId) || {
      topicCount: 0,
      memberCount: 0,
      messageCount: 0
    };

    // Удаляем временное поле dialogObjectId из ответа

    const { dialogObjectId: _dialogObjectId, ...dialogWithoutObjectId } = dialog;

    return {
      ...dialogWithoutObjectId,
      meta: dialogMeta,
      stats: stats,
      lastMessage: lastMessage
    };
  })
);

return {
  data: sanitizeResponse(finalDialogs) as any[],
  pagination: {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit)
  }
};
}
