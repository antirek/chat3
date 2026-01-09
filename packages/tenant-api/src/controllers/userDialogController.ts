import { 
  DialogMember, Dialog, Message, 
  Meta, MessageStatus, 
  // MessageReaction, 
  User,
  UserDialogStats,
  UserDialogActivity,
  UserStats,
  Topic,
  DialogStats,
  UserTopicStats
} from '@chat3/models';
import * as topicUtils from '@chat3/utils/topicUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { parseFilters, extractMetaFilters, parseSort } from '../utils/queryParser.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { validateGetUserDialogMessagesResponse, validateGetUserDialogMessageResponse } from '../validators/schemas/responseSchemas.js';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
// eslint-disable-next-line no-unused-vars
import * as dialogMemberUtils from '../utils/dialogMemberUtils.js';
import {
  getSenderInfo,
  mergeMetaRecords,
  buildStatusMessageMatrix,
  buildReactionSet,
  getContextUserInfo
   
} from '@chat3/utils/userDialogUtils.js';
import mongoose from 'mongoose';
import { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/apiAuth.js';

const userDialogController = {
  // Get user's dialogs with optional last message
  async getUserDialogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /users/:userId/dialogs';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { userId } = req.params;
      const page = parseInt(String(req.query.page || '1')) || 1;
      const limit = parseInt(String(req.query.limit || '10')) || 10;
      const skip = (page - 1) * limit;
      log(`Получены параметры: userId=${userId}, page=${page}, limit=${limit}, filter=${req.query.filter || 'нет'}`);
      const fetchMeta = (entityType, entityId) => metaUtils.getEntityMeta(
        req.tenantId,
        entityType,
        entityId
      );

      let dialogIds: string[] | null = null;
      let regularFilters: any = {};

      // Фильтрация по метаданным
      if (req.query.filter) {
        try {
          // Парсим фильтры (поддержка как JSON, так и (field,operator,value) формата)
          const parsedFilters = parseFilters(String(req.query.filter));
          
          // Извлекаем meta фильтры и member фильтры
          const { metaFilters, regularFilters: extractedRegularFilters, memberFilters } = extractMetaFilters(parsedFilters);
          regularFilters = extractedRegularFilters;
          
          // Обрабатываем meta фильтры (исключая topic.meta.*, которые обрабатываются отдельно)
          const dialogMetaFilters = Object.fromEntries(
            Object.entries(metaFilters).filter(([key]) => !key.startsWith('topic.meta.'))
          );
          
          if (Object.keys(dialogMetaFilters).length > 0) {
          const metaQuery = {
              tenantId: req.tenantId, // tenantId теперь строка (tnt_*)
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
            res.status(400).json({
              error: 'Bad Request',
              message: 'Filter format (topicId,*) is deprecated. Use (topic.topicId,*) instead.'
            });
            return;
          }
          
          // Обрабатываем фильтры по топикам (новый формат topic.topicId)
          if (regularFilters.topic && regularFilters.topic.topicId !== undefined) {
            // Находим диалоги текущего пользователя
            const userDialogs = await DialogMember.find({
              userId: userId,
              tenantId: req.tenantId,
            }).select('dialogId').lean();
            
            const userDialogIds = userDialogs.map(d => d.dialogId);
            
            if (userDialogIds.length === 0) {
              res.json({
                data: [],
                pagination: { page, limit, total: 0, pages: 0 }
              });
              return;
            }
            
            const topicIdCondition = regularFilters.topic.topicId;
            let foundDialogIds = null;
            
            // Обработка различных операторов для topic.topicId
            if (typeof topicIdCondition === 'object') {
              if (topicIdCondition.$ne === null) {
                // Фильтр topic.topicId,ne,null - диалоги с любыми топиками
                const topics = await Topic.find({
                  tenantId: req.tenantId,
                  dialogId: { $in: userDialogIds }
                }).select('dialogId').lean();
                
                foundDialogIds = [...new Set(topics.map(t => t.dialogId))];
              } else if (topicIdCondition.$in) {
                // Фильтр topic.topicId,in,[topic1,topic2,...] - диалоги с любым из указанных топиков
                const topics = await Topic.find({
                  tenantId: req.tenantId,
                  topicId: { $in: topicIdCondition.$in },
                  dialogId: { $in: userDialogIds }
                }).select('dialogId').lean();
                
                foundDialogIds = [...new Set(topics.map(t => t.dialogId))];
              } else if (topicIdCondition.$nin) {
                // Фильтр topic.topicId,nin,[topic1,topic2] - диалоги без указанных топиков
                const allTopics = await Topic.find({
                  tenantId: req.tenantId,
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
                  tenantId: req.tenantId,
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
                tenantId: req.tenantId,
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
              tenantId: req.tenantId,
            }).select('dialogId').lean();
            
            const userDialogIds = userDialogs.map(d => d.dialogId);
            
            if (userDialogIds.length === 0) {
              res.json({
                data: [],
                pagination: { page, limit, total: 0, pages: 0 }
              });
              return;
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
                    tenantId: req.tenantId,
                    entityType: 'topic',
                    key: param
                  }).select('entityId value').lean();
                  
                  topicIds = allMetaRecords
                    .filter(m => m.value !== conditionObj.$ne)
                    .map(m => m.entityId);
                } else if (conditionObj.$in) {
                  // Фильтр topic.meta.{key},in,[value1,value2] - топики с мета-тегом, значение которого в списке
                  const metaRecords = await Meta.find({
                    tenantId: req.tenantId,
                    entityType: 'topic',
                    key: param,
                    value: { $in: conditionObj.$in }
                  }).select('entityId').lean();
                  
                  topicIds = metaRecords.map(m => m.entityId);
                } else if (conditionObj.$nin) {
                  // Фильтр topic.meta.{key},nin,[value1,value2] - топики с мета-тегом, значение которого НЕ в списке
                  const allMetaRecords = await Meta.find({
                    tenantId: req.tenantId,
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
                      tenantId: req.tenantId,
                      entityType: 'topic',
                      key: param
                    }).select('entityId').lean();
                    
                    topicIds = metaRecords.map(m => m.entityId);
                  } else {
                    // Находим топики, НЕ имеющие мета-тег
                    // Получаем все топики в диалогах пользователя
                    const allTopics = await Topic.find({
                      tenantId: req.tenantId,
                      dialogId: { $in: userDialogIds }
                    }).select('topicId').lean();
                    
                    const allTopicIds = allTopics.map(t => t.topicId);
                    
                    // Получаем топики с мета-тегом
                    const topicsWithMeta = await Meta.find({
                      tenantId: req.tenantId,
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
                    tenantId: req.tenantId,
                    entityType: 'topic',
                    key: param,
                    value: conditionObj.$eq
                  }).select('entityId').lean();
                  
                  topicIds = metaRecords.map(m => m.entityId);
                } else {
                  // Для других операторов используем как есть
                  const metaRecords = await Meta.find({
                    tenantId: req.tenantId,
                    entityType: 'topic',
                    key: param,
                    value: condition
                  }).select('entityId').lean();
                  
                  topicIds = metaRecords.map(m => m.entityId);
                }
              } else {
                // Простое равенство: topic.meta.{key},eq,{value}
                const metaRecords = await Meta.find({
                  tenantId: req.tenantId,
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
                tenantId: req.tenantId,
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
              tenantId: req.tenantId,
            }).select('dialogId').lean();
            
            const userDialogIds = userDialogs.map(d => d.dialogId);
            
            if (userDialogIds.length === 0) {
              res.json({
                data: [],
                pagination: { page, limit, total: 0, pages: 0 }
              });
              return;
            }
            
            // Загружаем DialogStats для всех диалогов пользователя
            const dialogStats = await DialogStats.find({
              tenantId: req.tenantId,
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
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const userDialogIds = userDialogs.map(d => d.dialogId);
                
                if (userDialogIds.length === 0) {
                  res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                  return;
                }
                
                // Находим диалоги где есть указанный участник (но только из диалогов текущего пользователя)
                const targetDialogs = await DialogMember.find({
                  userId: memberValue,
                  dialogId: { $in: userDialogIds },
                  tenantId: req.tenantId
                }).select('dialogId').lean();
                
                const memberDialogIds = targetDialogs.map(d => d.dialogId);
                
                console.log('Member filter (single) applied, found dialogs:', memberDialogIds.length, 'with member:', memberValue);
                
                if (memberDialogIds.length === 0) {
                  res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                  return;
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
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const userDialogIds = userDialogs.map(d => d.dialogId);
                
                if (userDialogIds.length === 0) {
                  res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                  return;
                }
                
                // Находим диалоги где есть ЛЮБОЙ из указанных участников (но только из диалогов текущего пользователя)
                const targetDialogs = await DialogMember.find({
                  userId: { $in: targetUserIds },
                  dialogId: { $in: userDialogIds },
                  tenantId: req.tenantId,
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
                  res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                  return;
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
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const userDialogIds = userDialogs.map(d => d.dialogId);
                
                if (userDialogIds.length === 0) {
                  res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                  return;
                }
                
                // Находим все участники для указанных пользователей в диалогах текущего пользователя
                const allTargetMembers = await DialogMember.find({
                  userId: { $in: targetUserIds },
                  dialogId: { $in: userDialogIds },
                  tenantId: req.tenantId,
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
                  res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                  return;
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
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const userDialogIds = userDialogs.map(d => d.dialogId);
                
                if (userDialogIds.length === 0) {
                  res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                  return;
                }
                
                // Находим диалоги где есть исключаемый участник
                const dialogsWithExcluded = await DialogMember.find({
                  userId: excludedUserId,
                  dialogId: { $in: userDialogIds },
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const excludedDialogIds = new Set(dialogsWithExcluded.map(d => d.dialogId));
                
                // Исключаем эти диалоги из списка
                const memberDialogIds = userDialogIds.filter(dialogId => !excludedDialogIds.has(dialogId));
                
                console.log('Member filter ($ne) applied, found dialogs:', memberDialogIds.length, 'excluding member:', excludedUserId);
                
                if (memberDialogIds.length === 0) {
                  res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                  return;
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
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const userDialogIds = userDialogs.map(d => d.dialogId);
                
                if (userDialogIds.length === 0) {
                  res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                  return;
                }
                
                // Находим диалоги где есть хотя бы один из исключаемых участников
                const dialogsWithExcluded = await DialogMember.find({
                  userId: { $in: excludedUserIds },
                  dialogId: { $in: userDialogIds },
                  tenantId: req.tenantId,
                }).select('dialogId').lean();
                
                const excludedDialogIds = new Set(dialogsWithExcluded.map(d => d.dialogId));
                
                // Исключаем эти диалоги из списка
                const memberDialogIds = userDialogIds.filter(dialogId => !excludedDialogIds.has(dialogId));
                
                console.log('Member filter ($nin) applied, found dialogs:', memberDialogIds.length, 'excluding members:', excludedUserIds);
                
                if (memberDialogIds.length === 0) {
                  res.json({
                    data: [],
                    pagination: { page, limit, total: 0, pages: 0 }
                  });
                  return;
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
          
        } catch (error: any) {
          res.status(400).json({
            error: 'Bad Request',
            message: `Invalid filter format. ${error.message}. Examples: {"meta":{"key":"value"}} or (meta.key,eq,value) or (meta.key,ne,value)&(meta.key2,in,[val1,val2])`
          });
          return;
        }
      }

      // Get user's dialog memberships
      const dialogMembersQuery: any = {
        userId: userId,
        tenantId: req.tenantId
      };
      
      // Применяем обычные фильтры (например, dialogId) к dialogMembersQuery
      // Но если есть dialogId в regularFilters, обрабатываем его отдельно
      const { dialogId: regularDialogId, ...otherRegularFilters } = regularFilters;
      
      // Применяем другие regularFilters к dialogMembersQuery
      // lastSeenAt и lastMessageAt теперь в UserDialogActivity, обрабатываем отдельно
      // unreadCount теперь в UserDialogStats, обрабатываем отдельно
      if (Object.keys(otherRegularFilters).length > 0) {
        // Применяем фильтры для полей DialogMember (кроме unreadCount, lastSeenAt, lastMessageAt)
        const excludedFields = ['unreadCount', 'lastSeenAt', 'lastMessageAt'];
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
      if (req.query.unreadCount !== undefined || otherRegularFilters.unreadCount !== undefined) {
        const unreadCountValue = req.query.unreadCount !== undefined 
          ? req.query.unreadCount 
          : otherRegularFilters.unreadCount;
        
        console.log('req.query.unreadCount:', unreadCountValue, 'type:', typeof unreadCountValue);
        
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
      if (req.query.lastSeenAt !== undefined || otherRegularFilters.lastSeenAt !== undefined) {
        const lastSeenAtValue = req.query.lastSeenAt !== undefined 
          ? req.query.lastSeenAt 
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
      
      if (req.query.lastMessageAt !== undefined || otherRegularFilters.lastMessageAt !== undefined) {
        const lastMessageAtValue = req.query.lastMessageAt !== undefined 
          ? req.query.lastMessageAt 
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
          res.json({
            data: [],
            pagination: {
              page,
              limit,
              total: 0,
              pages: 0
            }
          });
          return;
        }
        
        // Если также есть regularFilters.dialogId, делаем пересечение
        if (regularDialogId !== undefined) {
          // Преобразуем regularDialogId в массив для сравнения
          const regularDialogIdArray = Array.isArray(regularDialogId) ? regularDialogId : [regularDialogId];
          // Пересечение: оставляем только те dialogIds, которые есть и в dialogIds, и в regularDialogId
          dialogIds = dialogIds.filter(id => regularDialogIdArray.includes(id));
          
          if (dialogIds.length === 0) {
            // Нет диалогов, удовлетворяющих обоим условиям
            res.json({
              data: [],
              pagination: {
                page,
                limit,
                total: 0,
                pages: 0
              }
            });
            return;
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
                      { $eq: ['$tenantId', req.tenantId] },
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
          tenantId: req.tenantId,
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
      if (dialogIds !== null && req.query.filter) {
        try {
          const parsedFilters = parseFilters(String(req.query.filter));
          const { memberFilters } = extractMetaFilters(parsedFilters);
          
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
              tenantId: req.tenantId
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
      } catch (error: any) {
        console.error('Error verifying member filter:', error);
      }
      }

      // Загружаем все диалоги одним запросом
      const dialogsData = await Dialog.find({
        dialogId: { $in: uniqueDialogIds },
        tenantId: req.tenantId
      }).select('dialogId name createdAt _id').lean();

      // Создаем Map для быстрого поиска
      const dialogsMap = new Map(dialogsData.map(d => [d.dialogId, d]));

      // Загружаем всех участников для этих диалогов одним запросом (для подсчета)
      const allMembers = await DialogMember.find({
        dialogId: { $in: uniqueDialogIds },
        tenantId: req.tenantId,
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
          tenantId: req.tenantId,
          userId: userId,
          dialogId: { $in: memberDialogIds }
        }).select('dialogId unreadCount').lean();
        
        userDialogStats.forEach(stat => {
          userDialogStatsMap.set(stat.dialogId, stat.unreadCount || 0);
        });
      }

      // Format response data
      const dialogs = dialogMembers
        .map(member => {
          const dialog = dialogsMap.get(member.dialogId);
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
      if (req.query.sort) {
        // Parse sort parameter in format (field,direction)
        const sortMatch = String(req.query.sort).match(/\(([^,]+),([^)]+)\)/);
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
          console.log('Invalid sort format:', req.query.sort);
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
      const lastMessages = await Promise.all(
        paginatedDialogs.map(async (dialog) => {
          const lastMsg = await Message.findOne({
            dialogId: dialog.dialogId, // Используем dialogId (строку dlg_*), а не ObjectId
            tenantId: req.tenantId
          })
            .sort({ createdAt: -1 })
            .select('messageId content senderId type createdAt')
            .lean();
          
          return { dialogId: dialog.dialogId, message: lastMsg };
        })
      );

      // Создаем Map последних сообщений
      const lastMessagesMap = new Map<string, any>();
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
        tenantId: req.tenantId
      }).select('userId name').lean();

      // Загружаем meta для отправителей (для всех senderIds, даже если пользователя нет в User)
      const sendersMetaQuery = {
        tenantId: req.tenantId,
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

      // Создаем Map отправителей
      const sendersMap = new Map<string, any>();
      
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

      // Получаем DialogStats для всех диалогов одним запросом
      const dialogIdsForStats = paginatedDialogs.map(d => d.dialogId);
      const dialogStatsMap = new Map();
      if (dialogIdsForStats.length > 0) {
        const dialogStats = await DialogStats.find({
          tenantId: req.tenantId,
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
              createdAt: lastMsg.createdAt
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
          // eslint-disable-next-line no-unused-vars
          const { dialogObjectId, ...dialogWithoutObjectId } = dialog;

          return {
            ...dialogWithoutObjectId,
            meta: dialogMeta,
            stats: stats,
            lastMessage: lastMessage
          };
        })
      );

      log(`Всего диалогов: ${total}, найдено: ${finalDialogs.length}, страница: ${page}, лимит: ${limit}`);
      log(`Отправка ответа: ${finalDialogs.length} диалогов`);
      res.json({
        data: sanitizeResponse(finalDialogs),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Get messages from a dialog in context of specific user
  async getUserDialogMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /users/:userId/dialogs/:dialogId/messages';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { userId, dialogId } = req.params;
      const page = parseInt(String(req.query.page || '1')) || 1;
      const limit = parseInt(String(req.query.limit || '50')) || 50;
      const skip = (page - 1) * limit;
      log(`Получены параметры: userId=${userId}, dialogId=${dialogId}, page=${page}, limit=${limit}`);
      const fetchMeta = (entityType, entityId) => metaUtils.getEntityMeta(
        req.tenantId,
        entityType,
        entityId
      );

      // 1. Проверяем, что пользователь является участником диалога
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId,
        userId: userId
      });

      if (!member) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a member of this dialog'
        });
        return;
      }

      // 2. Получаем диалог для проверки существования
      const dialog = await Dialog.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId
      });

      if (!dialog) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
        return;
      }

      // 3. Получаем сообщения диалога
      const query: any = {
        tenantId: req.tenantId,
        dialogId: dialogId
      };

      // Поддержка фильтрации
      if (req.query.filter) {
        try {
          const parsedFilters = parseFilters(String(req.query.filter));
          const { metaFilters, regularFilters } = extractMetaFilters(parsedFilters);
          
          // Применяем обычные фильтры
          for (const [field, condition] of Object.entries(regularFilters)) {
            // Валидация: отклоняем старый формат (topicId,*)
            if (field === 'topicId') {
              res.status(400).json({
                error: 'Bad Request',
                message: 'Filter format (topicId,*) is deprecated. Use (topic.topicId,*) instead.'
              });
              return;
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
              tenantId: req.tenantId,
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
              res.json({
                data: [],
                pagination: {
                  page,
                  limit,
                  total: 0,
                  pages: 0
                }
              });
              return;
            }
          }
        } catch (err: any) {
          console.error('Error parsing filter:', err);
          res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid filter format'
          });
          return;
        }
      }

      // Получаем общее количество
      const total = await Message.countDocuments(query);

      // Получаем сообщения с сортировкой по времени создания (новые сначала по умолчанию)
      let sortOption: any = '-createdAt'; // По умолчанию
      
      if (req.query.sort) {
        // Пробуем распарсить формат (field,direction)
        const parsedSort = parseSort(String(req.query.sort));
        if (parsedSort) {
          sortOption = parsedSort;
        } else {
          // Если не удалось распарсить, используем как есть (для обратной совместимости)
          sortOption = String(req.query.sort);
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
        tenantId: req.tenantId,
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
      const contextUserInfo = await getContextUserInfo(req.tenantId, userId, fetchMeta);
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
          topicsMap = await topicUtils.getTopicsWithMetaBatch(req.tenantId, dialogId, topicIds);
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
          const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId, message.messageId, message.senderId);

          // Формируем reactionSet
          const reactionSet = await buildReactionSet(req.tenantId, message.messageId, userId);

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

          const senderInfo = await getSenderInfo(req.tenantId, message.senderId, senderInfoCache);

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

      const response = {
        data: sanitizedMessages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

      // Валидация структуры ответа (только в development)
      if (process.env.NODE_ENV !== 'production') {
        const validation = validateGetUserDialogMessagesResponse(response as any);
        if (!validation.valid) {
          console.warn('Response validation warning:', validation.error);
        }
      }

      log(`Отправка ответа: ${sanitizedMessages.length} сообщений, страница: ${page}, лимит: ${limit}`);
      res.json(response);
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      console.error('Error in getUserDialogMessages:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Get single message from dialog in context of specific user
  async getUserDialogMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /users/:userId/dialogs/:dialogId/messages/:messageId';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { userId, dialogId, messageId } = req.params;
      log(`Получены параметры: userId=${userId}, dialogId=${dialogId}, messageId=${messageId}`);
      const fetchMeta = (entityType, entityId) => metaUtils.getEntityMeta(
        req.tenantId,
        entityType,
        entityId
      );

      // 1. Проверяем, что пользователь является участником диалога
      log(`Проверка участника: userId=${userId}, dialogId=${dialogId}`);
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId,
        userId: userId
      });

      if (!member) {
        log(`Пользователь не является участником: userId=${userId}, dialogId=${dialogId}`);
        res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a member of this dialog'
        });
        return;
      }
      log(`Участник найден: userId=${userId}`);

      // 2. Получаем сообщение
      log(`Поиск сообщения: messageId=${messageId}, dialogId=${dialogId}`);
      const message = await Message.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId,
        messageId: messageId
      }).lean();

      if (!message) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
        return;
      }

      // 3. Получаем все статусы сообщения (для всех пользователей)
      // eslint-disable-next-line no-unused-vars
      const allStatuses = await MessageStatus.find({
        tenantId: req.tenantId,
        messageId: messageId
      }).select('messageId userId userType tenantId status createdAt').lean();

      // 4. Фильтруем статусы для текущего пользователя
      // const myStatuses = allStatuses.filter(s => s.userId === userId);

      // 4.5. Формируем матрицу статусов по userType и status (исключая статусы отправителя сообщения)
      const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId, messageId, message.senderId);

      // 5. Формируем reactionSet
      const reactionSet = await buildReactionSet(req.tenantId, messageId, userId);

      // 7. Получаем метаданные сообщения
      const messageMeta = await fetchMeta('message', message.messageId);

      // 7.4. Получаем информацию о топике, если topicId указан
      let topic = null;
      const messageTopicId = (message as any).topicId;
      if (messageTopicId) {
        try {
          topic = await topicUtils.getTopicWithMeta(req.tenantId, dialogId, messageTopicId);
        } catch (error) {
          console.error('Error getting topic with meta:', error);
          topic = { topicId: messageTopicId, meta: {} };
        }
      }

      // 7.5. Загружаем информацию о пользователе из контекста
      const contextUserInfo = await getContextUserInfo(req.tenantId, userId, fetchMeta);

      // 8. Формируем ответ с контекстом пользователя
      const contextData: any = {
        userId: userId,
        isMine: message.senderId === userId
        // statuses: null, // Статусы только для данного пользователя
        // statuses: myStatuses, // Закомментировано: всегда возвращаем null
        // myReaction: userReaction // Удалено: используйте reactionSet для получения информации о реакциях
      };

      // Добавляем userInfo если пользователь найден
      if (contextUserInfo) {
        contextData.userInfo = contextUserInfo;
      }

      const senderInfo = await getSenderInfo(req.tenantId, message.senderId, undefined);

      const enrichedMessage = {
        ...message,
        meta: messageMeta,
        topic: topic, // Добавляем topic в ответ
        // Контекстные данные для конкретного пользователя
        context: contextData,
        // Матрица статусов (количество пар userType-status, исключая статусы отправителя)
        statusMessageMatrix: statusMessageMatrix,
        reactionSet: reactionSet,
        senderInfo: senderInfo || null
      };

      const response = {
        data: sanitizeResponse(enrichedMessage)
      };

      // Валидация структуры ответа (только в development)
      if (process.env.NODE_ENV !== 'production') {
        const validation = validateGetUserDialogMessageResponse(response as any);
        if (!validation.valid) {
          console.warn('Response validation warning:', validation.error);
        }
      }

      log(`Отправка ответа: messageId=${messageId}`);
      res.json(response);
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      console.error('Error in getUserDialogMessage:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },


  /**
   * Получение постраничного списка всех статусов сообщения из истории
   * 
   * ВАЖНО: MessageStatus хранит полную историю изменений статусов.
   * Каждое изменение статуса создает новую запись в истории.
   * 
   * Возвращает все записи статусов для сообщения, отсортированные по времени создания
   * (новые первыми). Один пользователь может иметь несколько записей.
   * 
   * @param {Object} req - Express request object
   * @param {Object} req.params - Параметры пути
   * @param {string} req.params.userId - ID пользователя
   * @param {string} req.params.dialogId - ID диалога
   * @param {string} req.params.messageId - ID сообщения
   * @param {Object} req.query - Query параметры
   * @param {number} req.query.page - Номер страницы (по умолчанию 1)
   * @param {number} req.query.limit - Количество записей на странице (по умолчанию 50)
   * @param {Object} res - Express response object
   */
  async getMessageStatuses(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /users/:userId/dialogs/:dialogId/messages/:messageId/statuses';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { userId, dialogId, messageId } = req.params;
      const page = parseInt(String(req.query.page || '1'), 10) || 1;
      const limit = parseInt(String(req.query.limit || '50'), 10) || 50;
      const skip = (page - 1) * limit;
      log(`Получены параметры: userId=${userId}, dialogId=${dialogId}, messageId=${messageId}, page=${page}, limit=${limit}`);

      // Нормализуем dialogId (в нижний регистр, как в модели)
      const normalizedDialogId = dialogId.toLowerCase().trim();

      // 1. Проверяем, что пользователь является участником диалога
      log(`Проверка участника: userId=${userId}, dialogId=${normalizedDialogId}`);
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: normalizedDialogId,
        userId: userId
      });

      if (!member) {
        log(`Пользователь не является участником: userId=${userId}, dialogId=${normalizedDialogId}`);
        res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a member of this dialog'
        });
        return;
      }
      log(`Участник найден: userId=${userId}`);

      // 2. Проверяем, что сообщение существует
      log(`Поиск сообщения: messageId=${messageId}, dialogId=${normalizedDialogId}`);
      const message = await Message.findOne({
        tenantId: req.tenantId,
        dialogId: normalizedDialogId,
        messageId: messageId
      }).lean();

      if (!message) {
        log(`Сообщение не найдено: messageId=${messageId}`);
        res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
        return;
      }
      log(`Сообщение найдено: messageId=${message.messageId}`);

      // 3. Получаем общее количество записей в истории статусов
      log(`Подсчет общего количества статусов: messageId=${messageId}`);
      const total = await MessageStatus.countDocuments({
        tenantId: req.tenantId,
        messageId: messageId
      });
      log(`Всего статусов: ${total}`);

      // 4. Получаем записи истории статусов с пагинацией
      // Сортируем по времени создания в порядке убывания (новые первыми)
      log(`Получение статусов: skip=${skip}, limit=${limit}`);
      const statuses = await MessageStatus.find({
        tenantId: req.tenantId,
        messageId: messageId
      })
        .select('messageId userId userType tenantId status createdAt')
        .sort({ createdAt: -1 }) // Новые записи первыми
        .skip(skip)
        .limit(limit)
        .lean();
      log(`Найдено статусов: ${statuses.length}`);

      const pages = Math.ceil(total / limit);

      log(`Отправка ответа: ${statuses.length} статусов, страница: ${page}, лимит: ${limit}`);
      res.json({
        data: statuses,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      console.error('Error in getMessageStatuses:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Middleware для проверки членства пользователя в диалоге
  async checkDialogMembership(req: AuthenticatedRequest, res: Response, next: any): Promise<void> {
    try {
      const { userId, dialogId } = req.params;

      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: dialogId,
        userId: userId
      });

      if (!member) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a member of this dialog'
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  /**
   * Создание новой записи в истории статусов сообщения
   * 
   * ВАЖНО: Каждое изменение статуса создает новую запись в истории (не обновляет существующую).
   * MessageStatus хранит полную историю всех изменений статусов для каждого пользователя.
   * 
   * При создании записи:
   * 1. Автоматически заполняется поле userType на основе типа пользователя
   * 2. Получается последний статус пользователя для определения oldStatus
   * 3. Автоматически обновляются счетчики непрочитанных сообщений (через pre-save hook)
   * 4. Генерируется событие изменения статуса для других участников диалога
   * 
   * @param {Object} req - Express request object
   * @param {Object} req.params - Параметры пути
   * @param {string} req.params.userId - ID пользователя
   * @param {string} req.params.dialogId - ID диалога
   * @param {string} req.params.messageId - ID сообщения
   * @param {string} req.params.status - Новый статус (unread, delivered, read)
   * @param {Object} res - Express response object
   */
  async updateMessageStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'post /users/:userId/dialogs/:dialogId/messages/:messageId/status/:status';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { userId, dialogId, messageId, status } = req.params;
      log(`Получены параметры: userId=${userId}, dialogId=${dialogId}, messageId=${messageId}, status=${status}`);

      // Basic validation
      if (!['unread', 'delivered', 'read'].includes(status)) {
        log(`Ошибка валидации: неверный status=${status}`);
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid status. Must be one of: unread, delivered, read'
        });
        return;
      }

      // Check if message exists and belongs to dialog and tenant
      log(`Поиск сообщения: messageId=${messageId}, dialogId=${dialogId}, tenantId=${req.tenantId}`);
      const message = await Message.findOne({
        messageId: messageId,
        dialogId: dialogId,
        tenantId: req.tenantId
      });

      if (!message) {
        log(`Сообщение не найдено: messageId=${messageId}`);
        res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
        return;
      }
      log(`Сообщение найдено: messageId=${message.messageId}`);

      // Получаем тип пользователя для заполнения поля userType
      log(`Получение типа пользователя: userId=${userId}`);
      const user = await User.findOne({
        tenantId: req.tenantId,
        userId: userId
      }).select('type').lean();
      
      const userType = user?.type || null;
      log(`Тип пользователя: userType=${userType || 'null'}`);

      // Получаем последний статус для определения oldStatus (для событий и счетчиков)
      log(`Получение последнего статуса: messageId=${messageId}, userId=${userId}`);
      const lastStatus = await MessageStatus.findOne({
        messageId: messageId,
        userId: userId,
        tenantId: req.tenantId
      })
        .sort({ createdAt: -1 })
        .lean();

      const oldStatus = lastStatus?.status || null;
      log(`Последний статус: oldStatus=${oldStatus || 'null'}, новый статус: ${status}`);

      // Получаем старое значение unreadCount ПЕРЕД созданием MessageStatus
      // (post-save hook обновит счетчик при создании)
      const oldUserDialogStats = await UserDialogStats.findOne({
        tenantId: req.tenantId,
        userId: userId,
        dialogId: dialogId
      }).lean();
      const oldUnreadCount = oldUserDialogStats?.unreadCount ?? 0;

      // Получаем диалог и его метаданные для события
      const dialog = await Dialog.findOne({
        dialogId: dialogId,
        tenantId: req.tenantId
      }).lean();

      if (!dialog) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
        return;
      }

      const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);
      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });

      // Получаем мета-теги сообщения для события
      const messageMeta = await metaUtils.getEntityMeta(req.tenantId, 'message', messageId);

      // Получаем топик для события, если topicId указан
      let topicForEvent: any = null;
      const messageTopicId = (message as any).topicId;
      if (messageTopicId) {
        try {
          topicForEvent = await topicUtils.getTopicWithMeta(req.tenantId, dialogId, messageTopicId);
        } catch (error) {
          console.error('Error getting topic with meta for event:', error);
          topicForEvent = { topicId: messageTopicId, meta: {} };
        }
      }

      // Формируем полную матрицу статусов для Event
      const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId, messageId, message.senderId);

      const messageSection = eventUtils.buildMessageSection({
        messageId,
        dialogId: dialogId,
        senderId: message.senderId,
        type: message.type,
        content: message.content,
        meta: messageMeta || {},
        topicId: messageTopicId || null,
        topic: topicForEvent,
        statusUpdate: {
          userId,
          status,
          oldStatus: oldStatus
        },
        statusMessageMatrix
      });

      const statusContext = eventUtils.buildEventContext({
        eventType: 'message.status.update',
        dialogId: dialogId,
        entityId: messageId,
        messageId,
        includedSections: ['dialog', 'message'],
        updatedFields: ['message.status']
      });

      // КРИТИЧНО: Создаем событие ДО создания MessageStatus, чтобы получить eventId
      const statusEvent = await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'message.status.update',
        entityType: 'messageStatus',
        entityId: messageId,
        actorId: userId,
        actorType: 'user',
        data: eventUtils.composeEventData({
          context: statusContext,
          dialog: dialogSection,
          message: messageSection
        })
      });

      const sourceEventId = statusEvent?.eventId || null;

      // Всегда создаем новую запись в истории статусов (не обновляем существующую)
      // КРИТИЧНО: Передаем sourceEventId через временное поле _sourceEventId
      log(`Создание новой записи статуса: messageId=${messageId}, userId=${userId}, status=${status}`);
      const newStatusData: any = {
        messageId: messageId,
        userId: userId,
        tenantId: req.tenantId,
        dialogId: dialogId, // КРИТИЧНО: Передаем dialogId для избежания поиска Message
        status: status,
        userType: userType, // Заполняем тип пользователя
        createdAt: generateTimestamp(),
        _sourceEventId: sourceEventId // Временное поле для передачи eventId в middleware
      };

      // Создаем новую запись в истории
      // post-save hook автоматически обновит счетчики непрочитанных сообщений
      const messageStatus = await MessageStatus.create([newStatusData]);
      const createdStatus = messageStatus[0];
      log(`Запись статуса создана: statusId=${createdStatus._id}`);

      // Получаем обновленный UserDialogStats после создания MessageStatus
      // (post-save hook уже обновил счетчик)
      const updatedUserDialogStats = await UserDialogStats.findOne({
        tenantId: req.tenantId,
        userId: userId,
        dialogId: dialogId
      }).lean();

      // Получаем активность из UserDialogActivity для lastSeenAt и lastMessageAt
      const dialogActivity = await UserDialogActivity.findOne({
        tenantId: req.tenantId,
        userId: userId,
        dialogId: dialogId
      }).lean();

      // Проверяем, изменился ли счетчик (сравниваем oldUnreadCount с новым)
      const _newUnreadCount = updatedUserDialogStats?.unreadCount ?? 0; // Используется в сравнении ниже
      const unreadCountChanged = oldUnreadCount !== _newUnreadCount;

      // Если счетчик был обновлен (изменился), создаем событие dialog.member.update
      if (updatedUserDialogStats && unreadCountChanged) {
        // Используем уже полученную секцию dialog из события message.status.update
        const memberSection = eventUtils.buildMemberSection({
          userId,
          state: {
            unreadCount: updatedUserDialogStats.unreadCount, // Используем из UserDialogStats
            lastSeenAt: dialogActivity?.lastSeenAt || null,
            lastMessageAt: dialogActivity?.lastMessageAt || null,
            isActive: true
          } as any
        });

        const memberContext = eventUtils.buildEventContext({
          eventType: 'dialog.member.update',
          dialogId: dialogId,
          entityId: dialogId,
          includedSections: ['dialog', 'member'],
          updatedFields: ['member.state.unreadCount', 'member.state.lastSeenAt']
        });

        await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'dialog.member.update',
          entityType: 'dialogMember',
          entityId: dialogId,
          actorId: userId,
          actorType: 'user',
          data: eventUtils.composeEventData({
            context: memberContext,
            dialog: dialogSection,
            member: memberSection
          })
        });

        // Логика создания user.stats.update перенесена в update-worker
        // update-worker будет создавать UserUpdate на основе dialog.member.update событий
      }

      log(`Отправка успешного ответа: messageId=${messageId}, userId=${userId}, status=${status}`);
      res.json({
        data: sanitizeResponse(createdStatus),
        message: 'Message status updated successfully'
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);

      if ((error as any).name === 'CastError') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid message ID'
        });
        return;
      }
      if ((error as any).name === 'ValidationError') {
        res.status(400).json({
          error: 'Bad Request',
          message: (error as any).message
        });
        return;
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  /**
   * Получение топиков диалога в контексте пользователя
   * Возвращает топики с мета-тегами и количеством непрочитанных сообщений для пользователя
   */
  async getUserDialogTopics(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /users/:userId/dialogs/:dialogId/topics';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { userId, dialogId } = req.params;
      const page = parseInt(String(req.query.page || '1')) || 1;
      const limit = parseInt(String(req.query.limit || '20')) || 20;
      const skip = (page - 1) * limit;
      log(`Получены параметры: userId=${userId}, dialogId=${dialogId}, page=${page}, limit=${limit}`);

      // Проверка существования диалога
      log(`Поиск диалога: dialogId=${dialogId}, tenantId=${req.tenantId}`);
      const dialog = await Dialog.findOne({
        dialogId,
        tenantId: req.tenantId
      });

      if (!dialog) {
        log(`Диалог не найден: dialogId=${dialogId}`);
        res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
        return;
      }
      log(`Диалог найден: dialogId=${dialog.dialogId}`);

      // Проверка, что пользователь является участником диалога
      log(`Проверка участника: userId=${userId}, dialogId=${dialogId}`);
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId,
        userId
      });

      if (!member) {
        log(`Пользователь не является участником: userId=${userId}, dialogId=${dialogId}`);
        res.status(403).json({
          error: 'Forbidden',
          message: 'User is not a member of this dialog'
        });
        return;
      }
      log(`Участник найден: userId=${userId}`);

      // Получаем список топиков с пагинацией
      log(`Получение списка топиков: dialogId=${dialogId}, skip=${skip}, limit=${limit}`);
      const topics = await Topic.find({
        tenantId: req.tenantId,
        dialogId
      })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean();
      log(`Найдено топиков: ${topics.length}`);

      // Получаем общее количество топиков для пагинации
      const total = await Topic.countDocuments({
        tenantId: req.tenantId,
        dialogId
      });
      log(`Всего топиков: ${total}`);

      // Получаем unreadCount для каждого топика из UserTopicStats
      const topicIds = topics.map(t => t.topicId);
      log(`Получение статистики для ${topicIds.length} топиков: userId=${userId}`);
      const topicStats = await UserTopicStats.find({
        tenantId: req.tenantId,
        userId,
        dialogId,
        topicId: { $in: topicIds }
      }).lean();

      // Создаем Map для быстрого доступа к unreadCount
      const unreadCountMap = new Map<string, number>();
      topicStats.forEach(stat => {
        unreadCountMap.set(stat.topicId, stat.unreadCount || 0);
      });

      // Обогащаем топики мета-тегами и unreadCount
      log(`Обогащение топиков мета-тегами: ${topics.length} топиков`);
      const topicsWithContext = await Promise.all(
        topics.map(async (topic) => {
          const meta = await metaUtils.getEntityMeta(req.tenantId, 'topic', topic.topicId);
          const unreadCount = unreadCountMap.get(topic.topicId) || 0;

          return {
            ...topic,
            meta: meta || {},
            unreadCount
          };
        })
      );
      log(`Мета-теги получены для всех топиков`);

      log(`Отправка ответа: ${topicsWithContext.length} топиков, страница: ${page}, лимит: ${limit}`);
      res.json({
        data: sanitizeResponse(topicsWithContext),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  }
};

export default userDialogController;
