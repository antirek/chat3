import { Response, NextFunction } from 'express';
import { ApiJournal } from '@chat3/models';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import type { AuthenticatedRequest } from './apiAuth.js';

/**
 * Middleware для логирования всех API запросов
 * Фиксирует: дату, время, endpoint, время выполнения, статус код
 */
export function apiJournalMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const startTimestamp = generateTimestamp();

  // Получаем информацию о запросе
  const method = req.method;
  const endpoint = req.originalUrl || req.url;

  // Получаем размер запроса
  const requestSize = req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : null;

  // Сохраняем оригинальные методы для перехвата
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);
  const originalEnd = res.end.bind(res);

  let responseSize: number | null = null;

  // Перехватываем отправку ответа для получения размера
  res.send = function(body: any) {
    if (body !== undefined && body !== null) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      responseSize = Buffer.byteLength(bodyStr, 'utf8');
    }
    return originalSend(body);
  };

  res.json = function(body: any) {
    if (body !== undefined && body !== null) {
      responseSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
    }
    return originalJson(body);
  };

  res.end = function(chunk?: any, encoding?: any) {
    if (chunk) {
      responseSize = Buffer.byteLength(chunk, encoding || 'utf8');
    }
    return originalEnd(chunk, encoding);
  };

  // Логируем после завершения ответа
  res.on('finish', async () => {
    try {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Пропускаем логирование для AdminJS и статических файлов
      if (endpoint.startsWith('/admin') || 
          endpoint.startsWith('/api-docs') ||
          endpoint.startsWith('/api-test') ||
          endpoint === '/favicon.ico') {
        return;
      }

      // Создаем запись в журнале асинхронно (не блокируем ответ)
      // req.tenantId задаётся в apiAuth (маршрутный middleware), к моменту finish он уже установлен
      const journalTenantId = req.tenantId || 'tnt_default';
      
      // Сохраняем body только для POST/PUT/PATCH запросов с JSON body
      let requestBody: any = null;
      const methodsWithBody = ['POST', 'PUT', 'PATCH'];
      if (methodsWithBody.includes(method) && req.body && Object.keys(req.body).length > 0) {
        // Проверяем, что это JSON запрос
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          // Ограничиваем размер сохраняемых данных (максимум 10KB в JSON строке)
          const bodyStr = JSON.stringify(req.body);
          if (bodyStr.length <= 10000) {
            requestBody = req.body;
          } else {
            // Если слишком большой, сохраняем только информацию о размере
            requestBody = { 
              _truncated: true, 
              _size: bodyStr.length,
              _message: 'Request body too large to store'
            };
          }
        }
      }
      
      ApiJournal.create({
        tenantId: journalTenantId,
        method,
        endpoint,
        statusCode,
        duration,
        requestSize,
        responseSize,
        requestBody,
        createdAt: startTimestamp
      }).catch((err: any) => {
        // Логируем ошибку, но не прерываем выполнение
        console.error('Error saving API journal entry:', err.message);
      });
    } catch (error: any) {
      // Игнорируем ошибки логирования
      console.error('Error in API journal middleware:', error.message);
    }
  });

  next();
}
