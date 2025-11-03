import mongoose from 'mongoose';
import { DialogMember, Dialog, Message, Meta } from '../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';
import { parseFilters, extractMetaFilters } from '../utils/queryParser.js';

const userDialogController = {
  // Get user's dialogs with optional last message
  async getUserDialogs(req, res) {
    try {
      const { userId } = req.params;
      const includeLastMessage = req.query.includeLastMessage === 'true';
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      let dialogIds = null;

      // Фильтрация по метаданным
      if (req.query.filter) {
        console.log('Filter received:', req.query.filter);
        try {
          // Парсим фильтры (поддержка как JSON, так и (field,operator,value) формата)
          const parsedFilters = parseFilters(req.query.filter);
          console.log('Parsed filters:', parsedFilters);
          
          // Извлекаем meta фильтры
          const { metaFilters, regularFilters } = extractMetaFilters(parsedFilters);
          console.log('Meta filters:', metaFilters);
          console.log('Regular filters:', regularFilters);
          
          // Обрабатываем meta фильтры
          if (Object.keys(metaFilters).length > 0) {
            const metaQuery = {
              tenantId: new mongoose.Types.ObjectId(req.tenantId),
              entityType: 'dialog'
            };

            // Проходим по всем meta фильтрам
            for (const [key, condition] of Object.entries(metaFilters)) {
              let foundDialogIds;
              
              // Обработка негативных операторов ($ne, $nin) требует специальной логики
              const isNegativeOperator = typeof condition === 'object' && (condition.$ne !== undefined || condition.$nin !== undefined);
              
              if (isNegativeOperator) {
                // Для негативных операторов:
                // 1. Получаем все dialogId с этим ключом
                const allWithKey = await Meta.find({
                  ...metaQuery,
                  key: key
                }).select('entityId value').lean();
                
                // 2. Фильтруем по условию
                if (condition.$ne !== undefined) {
                  // $ne: не равно конкретному значению
                  foundDialogIds = allWithKey
                    .filter(m => m.value !== condition.$ne)
                    .map(m => m.entityId.toString());
                } else if (condition.$nin !== undefined) {
                  // $nin: не в массиве значений
                  foundDialogIds = allWithKey
                    .filter(m => !condition.$nin.includes(m.value))
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
          
          // Применяем обычные фильтры к query
          Object.assign(req.query, regularFilters);
          console.log('Regular filters applied:', regularFilters);
          
        } catch (error) {
          return res.status(400).json({
            error: 'Bad Request',
            message: `Invalid filter format. ${error.message}. Examples: {"meta":{"key":"value"}} or (meta.key,eq,value) or (meta.key,ne,value)&(meta.key2,in,[val1,val2])`
          });
        }
      }

      // Get user's dialog memberships
      const dialogMembersQuery = {
        userId: userId,
        tenantId: req.tenantId,
        isActive: true
      };

      // Применяем обычные фильтры (unreadCount, lastSeenAt, etc.)
      if (req.query.unreadCount !== undefined) {
        console.log('req.query.unreadCount:', req.query.unreadCount, 'type:', typeof req.query.unreadCount);
        
        // Поддержка операторов для unreadCount
        const unreadCountValue = req.query.unreadCount;
        
        if (typeof unreadCountValue === 'object' && unreadCountValue !== null) {
          // Объект с операторами MongoDB ($gte, $gt, $lte, $lt)
          dialogMembersQuery.unreadCount = unreadCountValue;
          console.log('Applied unreadCount object filter:', unreadCountValue);
        } else if (typeof unreadCountValue === 'string') {
          // Строка с префиксом оператора
          if (unreadCountValue.startsWith('gte:')) {
            const value = parseInt(unreadCountValue.substring(4));
            if (!isNaN(value)) {
              dialogMembersQuery.unreadCount = { $gte: value };
              console.log('Applied unreadCount gte filter:', value);
            }
          } else if (unreadCountValue.startsWith('gt:')) {
            const value = parseInt(unreadCountValue.substring(3));
            if (!isNaN(value)) {
              dialogMembersQuery.unreadCount = { $gt: value };
              console.log('Applied unreadCount gt filter:', value);
            }
          } else if (unreadCountValue.startsWith('lte:')) {
            const value = parseInt(unreadCountValue.substring(4));
            if (!isNaN(value)) {
              dialogMembersQuery.unreadCount = { $lte: value };
              console.log('Applied unreadCount lte filter:', value);
            }
          } else if (unreadCountValue.startsWith('lt:')) {
            const value = parseInt(unreadCountValue.substring(3));
            if (!isNaN(value)) {
              dialogMembersQuery.unreadCount = { $lt: value };
              console.log('Applied unreadCount lt filter:', value);
            }
          } else {
            // Точное равенство (eq)
            const unreadCount = parseInt(unreadCountValue);
            if (!isNaN(unreadCount)) {
              dialogMembersQuery.unreadCount = unreadCount;
              console.log('Applied unreadCount eq filter:', unreadCount);
            }
          }
        } else {
          // Число - точное равенство
          const unreadCount = parseInt(unreadCountValue);
          if (!isNaN(unreadCount)) {
            dialogMembersQuery.unreadCount = unreadCount;
            console.log('Applied unreadCount eq filter:', unreadCount);
          }
        }
        console.log('dialogMembersQuery after unreadCount:', dialogMembersQuery);
      }
      
      if (req.query.lastSeenAt !== undefined) {
        // Поддержка операторов для lastSeenAt
        const lastSeenAtValue = req.query.lastSeenAt;
        if (lastSeenAtValue.startsWith('gt:')) {
          dialogMembersQuery.lastSeenAt = { $gt: new Date(lastSeenAtValue.substring(3)) };
        } else if (lastSeenAtValue.startsWith('gte:')) {
          dialogMembersQuery.lastSeenAt = { $gte: new Date(lastSeenAtValue.substring(4)) };
        } else if (lastSeenAtValue.startsWith('lt:')) {
          dialogMembersQuery.lastSeenAt = { $lt: new Date(lastSeenAtValue.substring(3)) };
        } else if (lastSeenAtValue.startsWith('lte:')) {
          dialogMembersQuery.lastSeenAt = { $lte: new Date(lastSeenAtValue.substring(4)) };
        } else {
          dialogMembersQuery.lastSeenAt = new Date(lastSeenAtValue);
        }
        console.log('Applied lastSeenAt filter:', dialogMembersQuery.lastSeenAt);
      }

      // Если есть фильтрация по meta, ограничиваем выборку
      if (dialogIds !== null) {
        if (dialogIds.length === 0) {
          // Нет диалогов с такими meta
          return res.json({
            data: [],
            pagination: {
              page,
              limit,
              total: 0,
              pages: 0
            }
          });
        }
        dialogMembersQuery.dialogId = { $in: dialogIds };
      }

      const dialogMembers = await DialogMember.find(dialogMembersQuery)
        .populate('dialogId', 'name createdAt updatedAt')
        .sort({ lastSeenAt: -1 }) // Sort by last seen (most recent first)
        .lean();

      // Format response data
      const dialogs = dialogMembers.map(member => ({
        dialogId: member.dialogId._id,
        dialogName: member.dialogId.name,
        unreadCount: member.unreadCount,
        lastSeenAt: member.lastSeenAt,
        lastMessageAt: member.lastMessageAt,
        isActive: member.isActive,
        joinedAt: member.createdAt,
        // Calculate last interaction time (most recent of lastSeenAt or lastMessageAt)
        lastInteractionAt: new Date(Math.max(
          new Date(member.lastSeenAt || 0).getTime(),
          new Date(member.lastMessageAt || 0).getTime()
        ))
      }));

      // Apply sorting BEFORE pagination
      if (req.query.sort) {
        // Parse sort parameter in format (field,direction)
        const sortMatch = req.query.sort.match(/\(([^,]+),([^)]+)\)/);
        if (sortMatch) {
          const field = sortMatch[1];
          const direction = sortMatch[2];
          console.log('Sorting by:', field, direction);
        
          dialogs.sort((a, b) => {
            let aVal, bVal;
            
            if (field === 'lastSeenAt') {
              aVal = new Date(a.lastSeenAt || 0);
              bVal = new Date(b.lastSeenAt || 0);
            } else if (field === 'lastInteractionAt') {
              aVal = new Date(a.lastInteractionAt || 0);
              bVal = new Date(b.lastInteractionAt || 0);
            } else if (field === 'unreadCount') {
              aVal = a.unreadCount || 0;
              bVal = b.unreadCount || 0;
            } else {
              // Default sorting by lastInteractionAt
              aVal = new Date(a.lastInteractionAt || 0);
              bVal = new Date(b.lastInteractionAt || 0);
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
          dialogs.sort((a, b) => new Date(b.lastInteractionAt) - new Date(a.lastInteractionAt));
        }
      } else {
        // Sort by last interaction time (most recent first) - default
        dialogs.sort((a, b) => new Date(b.lastInteractionAt) - new Date(a.lastInteractionAt));
      }

      // Get total count for pagination (after sorting)
      const total = dialogs.length;

      // Apply pagination to the sorted results
      const paginatedDialogs = dialogs.slice(skip, skip + limit);

      // Get last message for each dialog if requested
      let finalDialogs = paginatedDialogs;
      if (includeLastMessage) {
        finalDialogs = await Promise.all(
          paginatedDialogs.map(async (dialog) => {
            const lastMessage = await Message.findOne({
              dialogId: dialog.dialogId,
              tenantId: req.tenantId
            })
              .sort({ createdAt: -1 })
              .select('content senderId type createdAt')
              .lean();

            return {
              ...dialog,
              lastMessage: lastMessage ? {
                content: lastMessage.content,
                senderId: lastMessage.senderId,
                type: lastMessage.type,
                createdAt: lastMessage.createdAt
              } : null
            };
          })
        );
      }

      console.log('Returning dialogs:', finalDialogs.length, 'total:', total);
      console.log('Dialog IDs used:', dialogIds);
      console.log('Filter was applied:', dialogIds !== null);
      console.log('Sort parameter:', req.query.sort);
      console.log('Include last message:', includeLastMessage);
      res.json({
        data: finalDialogs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

export default userDialogController;
