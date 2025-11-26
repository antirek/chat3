import { ApiJournal } from '../../../models/index.js';
import { generateTimestamp } from '../../../utils/timestampUtils.js';

/**
 * Middleware для логирования всех API запросов
 * Фиксирует: дату, время, endpoint, время выполнения, статус код
 */
export function apiJournalMiddleware(req, res, next) {
  const startTime = Date.now();
  const startTimestamp = generateTimestamp();

  // Получаем информацию о запросе
  const method = req.method;
  const endpoint = req.originalUrl || req.url;
  const tenantId = req.tenantId || null;
  
  // Получаем размер запроса
  const requestSize = req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : null;

  // Сохраняем оригинальные методы для перехвата
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;

  let responseSize = null;

  // Перехватываем отправку ответа для получения размера
  res.send = function(body) {
    if (body !== undefined && body !== null) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      responseSize = Buffer.byteLength(bodyStr, 'utf8');
    }
    return originalSend.call(this, body);
  };

  res.json = function(body) {
    if (body !== undefined && body !== null) {
      responseSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
    }
    return originalJson.call(this, body);
  };

  res.end = function(chunk, encoding) {
    if (chunk) {
      responseSize = Buffer.byteLength(chunk, encoding || 'utf8');
    }
    return originalEnd.call(this, chunk, encoding);
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
      // Используем 'tnt_unknown' если tenantId отсутствует (для соответствия формату модели)
      const journalTenantId = tenantId || 'tnt_unknown';
      
      // Сохраняем body только для POST/PUT/PATCH запросов с JSON body
      let requestBody = null;
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
      }).catch(err => {
        // Логируем ошибку, но не прерываем выполнение
        console.error('Error saving API journal entry:', err.message);
      });
    } catch (error) {
      // Игнорируем ошибки логирования
      console.error('Error in API journal middleware:', error.message);
    }
  });

  next();
}

