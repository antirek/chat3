import mongoose from 'mongoose';
import { DialogMember, Dialog, Message, Meta } from '../models/index.js';
import * as metaUtils from '../utils/metaUtils.js';
import { parseFilters, extractMetaFilters } from '../utils/queryParser.js';

const userDialogController = {
  // Get user's dialogs with pagination and sorting by last interaction
  async getUserDialogs(req, res) {
    try {
      const { userId } = req.params;
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

      // Get total count for pagination
      const total = await DialogMember.countDocuments(dialogMembersQuery);

      // Apply pagination to the results
      const paginatedDialogMembers = dialogMembers.slice(skip, skip + limit);

      // Format response data
      const dialogs = paginatedDialogMembers.map(member => ({
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

      // Apply sorting
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

      console.log('Returning dialogs:', dialogs.length, 'total:', total);
      console.log('Dialog IDs used:', dialogIds);
      console.log('Filter was applied:', dialogIds !== null);
      console.log('Sort parameter:', req.query.sort);
      res.json({
        data: dialogs,
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
  },

  // Get user's dialogs with detailed information including last message
  async getUserDialogsDetailed(req, res) {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      let dialogIds = null;

      // Фильтрация по метаданным
      if (req.query.filter) {
        try {
          // Парсим фильтры (поддержка как JSON, так и (field,operator,value) формата)
          const parsedFilters = parseFilters(req.query.filter);
          
          // Извлекаем meta фильтры
          const { metaFilters, regularFilters } = extractMetaFilters(parsedFilters);
          
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
        .sort({ lastSeenAt: -1 })
        .lean();

      // Get total count for pagination
      const total = await DialogMember.countDocuments(dialogMembersQuery);

      // Apply pagination to the results
      const paginatedDialogMembers = dialogMembers.slice(skip, skip + limit);

      // Get last message for each dialog
      const dialogsWithLastMessage = await Promise.all(
        paginatedDialogMembers.map(async (member) => {
          const lastMessage = await Message.findOne({
            dialogId: member.dialogId._id,
            tenantId: req.tenantId
          })
            .sort({ createdAt: -1 })
            .select('content senderId type createdAt')
            .lean();

          return {
            dialogId: member.dialogId._id,
            dialogName: member.dialogId.name,
            unreadCount: member.unreadCount,
            lastSeenAt: member.lastSeenAt,
            lastMessageAt: member.lastMessageAt,
            isActive: member.isActive,
            joinedAt: member.createdAt,
            lastInteractionAt: new Date(Math.max(
              new Date(member.lastSeenAt || 0).getTime(),
              new Date(member.lastMessageAt || 0).getTime()
            )),
            lastMessage: lastMessage ? {
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              type: lastMessage.type,
              createdAt: lastMessage.createdAt
            } : null
          };
        })
      );

      // Apply sorting
      if (req.query.sort) {
        // Parse sort parameter in format (field,direction)
        const sortMatch = req.query.sort.match(/\(([^,]+),([^)]+)\)/);
        if (sortMatch) {
          const field = sortMatch[1];
          const direction = sortMatch[2];
          console.log('Sorting by:', field, direction);
        
          dialogsWithLastMessage.sort((a, b) => {
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
          dialogsWithLastMessage.sort((a, b) => new Date(b.lastInteractionAt) - new Date(a.lastInteractionAt));
        }
      } else {
        // Sort by last interaction time (most recent first) - default
        dialogsWithLastMessage.sort((a, b) => new Date(b.lastInteractionAt) - new Date(a.lastInteractionAt));
      }

      res.json({
        data: dialogsWithLastMessage,
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
