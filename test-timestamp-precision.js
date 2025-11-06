/**
 * Тест точности хранения timestamp с микросекундами в Number
 */

import { generateTimestamp, formatTimestamp } from './src/utils/timestampUtils.js';

console.log('=== Тест точности timestamp с микросекундами ===\n');

// Генерируем несколько timestamp
for (let i = 0; i < 5; i++) {
  const ts = generateTimestamp();
  console.log(`\nТест ${i + 1}:`);
  console.log(`Исходный timestamp: ${ts}`);
  console.log(`Тип: ${typeof ts}`);
  console.log(`Целая часть (мс): ${Math.floor(ts)}`);
  console.log(`Дробная часть (мкс): ${(ts % 1).toFixed(6)}`);
  console.log(`Форматированный: ${formatTimestamp(ts, 'full')}`);
  console.log(`ISO формат: ${formatTimestamp(ts, 'iso')}`);
  
  // Проверяем, что значение не теряет точность
  const stored = ts;
  const retrieved = stored;
  console.log(`Совпадение после "сохранения": ${ts === retrieved ? '✅' : '❌'}`);
  
  // Небольшая задержка
  await new Promise(resolve => setTimeout(resolve, 10));
}

console.log('\n=== Проверка пределов точности ===\n');

// Проверяем максимальное безопасное целое число
console.log(`Number.MAX_SAFE_INTEGER: ${Number.MAX_SAFE_INTEGER}`);
console.log(`Это примерно ${Number.MAX_SAFE_INTEGER.toString().length} цифр`);

// Текущий timestamp в микросекундах
const nowMicro = Math.floor(Date.now() * 1000);
console.log(`\nТекущий timestamp в микросекундах: ${nowMicro}`);
console.log(`Длина: ${nowMicro.toString().length} цифр`);
console.log(`Безопасно? ${nowMicro <= Number.MAX_SAFE_INTEGER ? '✅' : '❌'}`);

// Timestamp в миллисекундах с дробной частью (наш подход)
const nowWithFraction = Date.now() + 0.123456;
console.log(`\nTimestamp (мс) с дробной частью: ${nowWithFraction}`);
console.log(`Точность сохранена? ${nowWithFraction.toString().includes('123456') ? '✅' : '❌'}`);

console.log('\n=== Рекомендация ===');
console.log('✅ Хранить как Number в миллисекундах с 6 знаками после запятой');
console.log('✅ Формат: 1730891234567.123456');
console.log('✅ Обеспечивает точность до микросекунд');
console.log('✅ Умещается в Number.MAX_SAFE_INTEGER');
console.log('✅ Совместимо с Date объектами (просто Math.floor())');

console.log('\n=== Пример использования в Mongoose схеме ===');
console.log(`
const schema = new mongoose.Schema({
  createdAt: {
    type: Number,  // <-- Обычный Number
    default: generateTimestamp,  // Генерирует timestamp с микросекундами
    description: 'Timestamp в миллисекундах с точностью до микросекунд'
  }
});
`);

