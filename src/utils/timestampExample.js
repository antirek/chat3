/**
 * Пример использования timestampUtils в моделях
 */

import mongoose from 'mongoose';
import { generateTimestamp, generateISOTimestamp, formatTimestamp } from './timestampUtils.js';

/**
 * ПРИМЕР 1: Модель с наносекундными метками времени
 * Используем Number для хранения timestamp с микросекундами
 */
const exampleSchema = new mongoose.Schema({
  name: String,
  
  // Вариант 1: Хранить как Number (микросекунды в миллисекундах)
  createdAtPrecise: {
    type: Number,
    default: generateTimestamp,
    description: 'Timestamp с точностью до микросекунд'
  },
  
  // Вариант 2: Хранить как String в ISO формате с микросекундами
  createdAtISO: {
    type: String,
    default: generateISOTimestamp,
    description: 'ISO 8601 строка с микросекундами'
  },
  
  // Для совместимости можно оставить обычный Date
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Виртуальное поле для форматированного отображения
exampleSchema.virtual('createdAtFormatted').get(function() {
  return formatTimestamp(this.createdAtPrecise, 'full');
});

exampleSchema.virtual('createdAtRelative').get(function() {
  return formatTimestamp(this.createdAtPrecise, 'relative');
});

// Включить виртуальные поля в JSON
exampleSchema.set('toJSON', { virtuals: true });
exampleSchema.set('toObject', { virtuals: true });

/**
 * ПРИМЕР 2: Pre-save hook для автоматической генерации точных меток времени
 */
const anotherExampleSchema = new mongoose.Schema({
  name: String,
  createdAtPrecise: Number,
  updatedAtPrecise: Number
});

// Автоматически устанавливаем createdAtPrecise при создании
anotherExampleSchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAtPrecise = generateTimestamp();
  }
  this.updatedAtPrecise = generateTimestamp();
  next();
});

/**
 * ПРИМЕР 3: Использование в контроллерах
 */
export function exampleControllerUsage() {
  // Генерируем timestamp
  const now = generateTimestamp();
  console.log('Timestamp:', now);
  
  // Форматируем для отображения
  console.log('Full format:', formatTimestamp(now, 'full'));
  console.log('Date only:', formatTimestamp(now, 'date'));
  console.log('Time only:', formatTimestamp(now, 'time'));
  console.log('ISO format:', formatTimestamp(now, 'iso'));
  console.log('Relative:', formatTimestamp(now, 'relative'));
  
  // Для API ответов
  const response = {
    data: {
      id: 'msg_123',
      content: 'Hello',
      createdAt: now,
      createdAtFormatted: formatTimestamp(now, 'full'),
      createdAtRelative: formatTimestamp(now, 'relative')
    }
  };
  
  return response;
}

/**
 * ПРИМЕР 4: Миграция существующих моделей
 * 
 * Для моделей Dialog, Message, Event и других:
 * 
 * 1. Добавить новое поле с точными метками времени:
 * 
 * createdAtPrecise: {
 *   type: Number,
 *   default: generateTimestamp
 * }
 * 
 * 2. Добавить виртуальное поле для форматирования:
 * 
 * schema.virtual('createdAtFormatted').get(function() {
 *   return formatTimestamp(this.createdAtPrecise || this.createdAt, 'full');
 * });
 * 
 * 3. В контроллерах использовать formatTimestamp для ответов:
 * 
 * const formattedData = {
 *   ...data,
 *   createdAtFormatted: formatTimestamp(data.createdAtPrecise, 'full'),
 *   createdAtRelative: formatTimestamp(data.createdAtPrecise, 'relative')
 * };
 */

export default {
  exampleSchema,
  anotherExampleSchema,
  exampleControllerUsage
};

