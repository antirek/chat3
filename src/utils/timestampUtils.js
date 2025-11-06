/**
 * Утилиты для работы с временными метками с точностью до наносекунд
 */

/**
 * Генерирует временную метку с микросекундами
 * Формат: миллисекунды Unix timestamp + дробная часть с микросекундами
 * Пример: 1730891234567.123456
 * @returns {number} Timestamp в миллисекундах с точностью до микросекунд
 */
export function generateTimestamp() {
  // Получаем текущее время в миллисекундах
  const now = Date.now();
  
  // Получаем высокоточное время для микросекунд
  const hrTime = process.hrtime.bigint();
  
  // Извлекаем микросекунды из текущей секунды
  // hrtime дает наносекунды с момента запуска, берем остаток от миллисекунды
  const nanosecondsInMillisecond = Number(hrTime % 1_000_000n);
  const microseconds = nanosecondsInMillisecond / 1000;
  
  // Объединяем: целая часть из Date.now() + дробная часть из hrtime
  return now + (microseconds / 1000);
}

/**
 * Генерирует временную метку в формате ISO 8601 с микросекундами
 * Формат: YYYY-MM-DDTHH:mm:ss.ffffffZ (где ffffff - микросекунды)
 * @returns {string} ISO 8601 строка с микросекундами
 */
export function generateISOTimestamp() {
  const now = Date.now();
  const hrTime = process.hrtime.bigint();
  
  // Получаем микросекунды от текущей секунды
  const microsecondsInSecond = Number(hrTime % 1000000000n) / 1000;
  
  // Создаем Date объект
  const date = new Date(now);
  
  // Получаем ISO строку и заменяем миллисекунды на микросекунды
  const isoString = date.toISOString();
  const [datePart, timePart] = isoString.split('T');
  const [time, _] = timePart.split('.');
  
  // Форматируем микросекунды как 6 цифр
  const microseconds = Math.floor(microsecondsInSecond).toString().padStart(6, '0');
  
  return `${datePart}T${time}.${microseconds}Z`;
}

/**
 * Преобразует timestamp в читаемый формат
 * @param {number|string|Date} timestamp - Временная метка
 * @param {string} format - Формат вывода ('full', 'date', 'time', 'datetime', 'iso', 'relative')
 * @param {string} locale - Локаль для форматирования (по умолчанию 'ru-RU')
 * @returns {string} Форматированная строка
 */
export function formatTimestamp(timestamp, format = 'full', locale = 'ru-RU') {
  let date;
  let microseconds = 0;
  
  // Обрабатываем разные типы входных данных
  if (typeof timestamp === 'number') {
    // Извлекаем целую и дробную части
    const integerPart = Math.floor(timestamp);
    const fractionalPart = timestamp - integerPart;
    
    // Дробная часть содержит микросекунды (0.123456 -> 123456 микросекунд)
    microseconds = Math.round(fractionalPart * 1000000);
    
    date = new Date(integerPart);
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
    // Пытаемся извлечь микросекунды из ISO строки
    const match = timestamp.match(/\.(\d{6})Z?$/);
    if (match) {
      microseconds = parseInt(match[1]);
    }
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    return 'Invalid timestamp';
  }
  
  if (isNaN(date.getTime())) {
    return 'Invalid timestamp';
  }
  
  const microsecondsStr = microseconds.toString().padStart(6, '0');
  
  switch (format) {
    case 'full':
      // Полный формат с микросекундами
      return date.toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) + `.${microsecondsStr}`;
      
    case 'date':
      // Только дата
      return date.toLocaleDateString(locale);
      
    case 'time':
      // Только время с микросекундами
      return date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) + `.${microsecondsStr}`;
      
    case 'datetime':
      // Дата и время без микросекунд
      return date.toLocaleString(locale);
      
    case 'iso':
      // ISO 8601 с микросекундами
      const isoString = date.toISOString();
      const [datePart, timePart] = isoString.split('T');
      const [time, _] = timePart.split('.');
      return `${datePart}T${time}.${microsecondsStr}Z`;
      
    case 'relative':
      // Относительное время (назад)
      return formatRelativeTime(date);
      
    default:
      return date.toLocaleString(locale);
  }
}

/**
 * Форматирует время относительно текущего момента
 * @param {Date} date - Дата для форматирования
 * @returns {string} Относительное время
 */
function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) {
    return `${diffSeconds} сек. назад`;
  } else if (diffMinutes < 60) {
    return `${diffMinutes} мин. назад`;
  } else if (diffHours < 24) {
    return `${diffHours} ч. назад`;
  } else if (diffDays < 7) {
    return `${diffDays} дн. назад`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} нед. назад`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} мес. назад`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} г. назад`;
  }
}

/**
 * Сравнивает две временные метки
 * @param {number|string|Date} timestamp1 
 * @param {number|string|Date} timestamp2 
 * @returns {number} -1 если timestamp1 < timestamp2, 0 если равны, 1 если timestamp1 > timestamp2
 */
export function compareTimestamps(timestamp1, timestamp2) {
  const t1 = typeof timestamp1 === 'number' ? timestamp1 : new Date(timestamp1).getTime();
  const t2 = typeof timestamp2 === 'number' ? timestamp2 : new Date(timestamp2).getTime();
  
  if (t1 < t2) return -1;
  if (t1 > t2) return 1;
  return 0;
}

/**
 * Преобразует наносекундный timestamp в Date объект
 * @param {number} timestamp - Timestamp с микросекундами
 * @returns {Date} Date объект
 */
export function timestampToDate(timestamp) {
  if (timestamp > 1e15) {
    return new Date(Math.floor(timestamp / 1000));
  }
  return new Date(timestamp);
}

/**
 * Получает текущее время в формате для MongoDB
 * MongoDB хранит Date в миллисекундах, но мы добавляем микросекунды в отдельное поле
 * @returns {Object} Объект с timestamp и microseconds
 */
export function getMongoTimestamp() {
  const hrTime = process.hrtime.bigint();
  const microseconds = Number(hrTime / 1000n);
  const milliseconds = Math.floor(microseconds / 1000);
  const microsecondsRemainder = microseconds % 1000;
  
  return {
    date: new Date(milliseconds),
    microseconds: microsecondsRemainder
  };
}

export default {
  generateTimestamp,
  generateISOTimestamp,
  formatTimestamp,
  compareTimestamps,
  timestampToDate,
  getMongoTimestamp
};

