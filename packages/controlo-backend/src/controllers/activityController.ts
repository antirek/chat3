import { Event, Update, ApiJournal } from '@chat3/models';
import { Request, Response } from 'express';

/**
 * Вспомогательная функция для заполнения пропущенных дней нулями
 */
function fillMissingDays(
  dataMap: Map<string, number>,
  days: number = 30
): { dates: string[]; values: number[] } {
  const dates: string[] = [];
  const values: number[] = [];
  
  // Получаем сегодняшнюю дату в локальном времени
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  
  // Генерируем все даты за последние 30 дней (включая сегодня)
  // От (сегодня - 29 дней) до сегодня включительно
  // i от 29 до 0: когда i=29, это (today - 29), когда i=0, это today
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(todayYear, todayMonth, todayDay - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    dates.push(dateStr);
    values.push(dataMap.get(dateStr) || 0);
  }
  
  // Дополнительная проверка: убеждаемся, что последняя дата - это сегодня
  const lastDate = dates[dates.length - 1];
  const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;
  
  if (lastDate !== todayStr) {
    console.log(`Warning: Last date ${lastDate} is not today ${todayStr}, adding today`);
    dates.push(todayStr);
    values.push(dataMap.get(todayStr) || 0);
  }
  
  return { dates, values };
}


export const activityController = {
  /**
   * @swagger
   * /api/activity/events-updates:
   *   get:
   *     summary: Get Events and Updates statistics for last 30 days
   *     tags: [Activity]
   *     description: |
   *       Возвращает статистику Events и Updates за последние 30 дней.
   *       Данные агрегируются по всем тенантам вместе.
   *       Для каждого дня возвращается количество Events и Updates.
   *     responses:
   *       200:
   *         description: Statistics data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     dates:
   *                       type: array
   *                       items:
   *                         type: string
   *                         format: date
   *                         example: "2024-01-16"
   *                     events:
   *                       type: array
   *                       items:
   *                         type: number
   *                       example: [10, 15, 20]
   *                     updates:
   *                       type: array
   *                       items:
   *                         type: number
   *                       example: [5, 8, 12]
   *       500:
   *         description: Internal Server Error
   */
  async getEventsUpdatesStats(req: Request, res: Response): Promise<void> {
    try {
      // Вычисляем начальную дату (30 дней назад, включая сегодня)
      // Нужно включить 30 дней: от (сегодня - 29 дней) до сегодня
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 29); // 29 дней назад, чтобы включить сегодня (итого 30 дней)
      
      // createdAt хранится в миллисекундах с дробной частью (микросекунды)
      // Например: 1730891234567.123456
      // Для сравнения используем целую часть (миллисекунды)
      const startTimestamp = startDate.getTime();
      
      // Верхняя граница - конец сегодняшнего дня (включая все записи за сегодня)
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);
      const endTimestamp = endOfToday.getTime();
      
      // Агрегация Events
      const eventsData = await Event.aggregate([
        {
          $match: {
            createdAt: { $gte: startTimestamp, $lte: endTimestamp }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $toDate: { $floor: '$createdAt' } }
              }
            },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Агрегация Updates
      const updatesData = await Update.aggregate([
        {
          $match: {
            createdAt: { $gte: startTimestamp, $lte: endTimestamp }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $toDate: { $floor: '$createdAt' } }
              }
            },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Создаем Map для быстрого доступа
      const eventsMap = new Map<string, number>();
      eventsData.forEach((item: any) => {
        eventsMap.set(item._id, item.count);
      });
      
      const updatesMap = new Map<string, number>();
      updatesData.forEach((item: any) => {
        updatesMap.set(item._id, item.count);
      });
      
      // Заполняем пропущенные дни
      const { dates, values: eventsValues } = fillMissingDays(eventsMap, 30);
      const { values: updatesValues } = fillMissingDays(updatesMap, 30);
      
      res.json({
        data: {
          dates,
          events: eventsValues,
          updates: updatesValues
        }
      });
    } catch (error: any) {
      console.error('Error getting events-updates stats:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  /**
   * @swagger
   * /api/activity/api-requests:
   *   get:
   *     summary: Get API requests statistics for last 30 days
   *     tags: [Activity]
   *     description: |
   *       Возвращает статистику API запросов из ApiJournal за последние 30 дней.
   *       Данные агрегируются по всем тенантам вместе.
   *       Для каждого дня возвращается общее количество запросов.
   *     responses:
   *       200:
   *         description: Statistics data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     dates:
   *                       type: array
   *                       items:
   *                         type: string
   *                         format: date
   *                         example: "2024-01-16"
   *                     requests:
   *                       type: array
   *                       items:
   *                         type: number
   *                       example: [100, 150, 200]
   *       500:
   *         description: Internal Server Error
   */
  async getApiRequestsStats(req: Request, res: Response): Promise<void> {
    try {
      // Вычисляем начальную дату (30 дней назад, включая сегодня)
      // Нужно включить 30 дней: от (сегодня - 29 дней) до сегодня включительно
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 29); // 29 дней назад, чтобы включить сегодня (итого 30 дней)
      
      // createdAt хранится в миллисекундах с дробной частью (микросекунды)
      // Например: 1730891234567.123456
      // Для сравнения используем целую часть (миллисекунды)
      const startTimestamp = startDate.getTime();
      
      // Верхняя граница - конец сегодняшнего дня (включая все записи за сегодня)
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);
      const endTimestamp = endOfToday.getTime();
      
      // Агрегация ApiJournal
      const apiRequestsData = await ApiJournal.aggregate([
        {
          $match: {
            createdAt: { $gte: startTimestamp, $lte: endTimestamp }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $toDate: { $floor: '$createdAt' } }
              }
            },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Создаем Map для быстрого доступа
      const requestsMap = new Map<string, number>();
      apiRequestsData.forEach((item: any) => {
        requestsMap.set(item._id, item.count);
      });
      
      // Заполняем пропущенные дни
      const { dates, values: requestsValues } = fillMissingDays(requestsMap, 30);
      
      res.json({
        data: {
          dates,
          requests: requestsValues
        }
      });
    } catch (error: any) {
      console.error('Error getting api-requests stats:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};
