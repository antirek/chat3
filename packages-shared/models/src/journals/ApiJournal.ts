import mongoose from 'mongoose';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { JOURNAL_LOG_TTL_SECONDS } from './journalLogTtl.js';

// TypeScript типы для ApiJournal
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

// TypeScript интерфейс для документа ApiJournal
export interface IApiJournal extends mongoose.Document {
  tenantId: string;
  method: HttpMethod;
  endpoint: string;
  statusCode: number;
  duration: number;
  requestSize?: number;
  responseSize?: number;
  requestBody?: unknown;
  createdAt: number;
  /** BSON Date for Mongo TTL monitor; createdAt stays Number for Controlo activity. */
  expireAt: Date;
}

const apiJournalSchema = new mongoose.Schema<IApiJournal>({
  tenantId: {
    type: String,
    required: true,
    index: true,
    description: 'ID тенанта'
  },
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    index: true,
    description: 'HTTP метод запроса'
  },
  endpoint: {
    type: String,
    required: true,
    trim: true,
    index: true,
    description: 'API endpoint (путь запроса)'
  },
  statusCode: {
    type: Number,
    required: true,
    index: true,
    description: 'HTTP статус код ответа'
  },
  duration: {
    type: Number,
    required: true,
    description: 'Время выполнения запроса в миллисекундах'
  },
  requestSize: {
    type: Number,
    description: 'Размер тела запроса в байтах'
  },
  responseSize: {
    type: Number,
    description: 'Размер тела ответа в байтах'
  },
  requestBody: {
    type: mongoose.Schema.Types.Mixed,
    description: 'Тело запроса (JSON) - сохраняется только для POST/PUT/PATCH запросов'
  },
  createdAt: {
    type: Number,
    default: generateTimestamp,
    required: true,
    index: true,
    description: 'Timestamp создания записи (микросекунды)'
  },
  expireAt: {
    type: Date,
    default: () => new Date(),
    required: true,
    description: 'BSON Date для MongoDB TTL (retention 60 дней, FDR-0002 / #15522)'
  }
}, {
  timestamps: false // Отключаем автоматические timestamps
});

// Индексы для производительности
apiJournalSchema.index({ tenantId: 1, createdAt: -1 });
apiJournalSchema.index({ endpoint: 1, createdAt: -1 });
apiJournalSchema.index({ method: 1, createdAt: -1 });
apiJournalSchema.index({ statusCode: 1, createdAt: -1 });

// Составной индекс для частых запросов
apiJournalSchema.index({ tenantId: 1, endpoint: 1, createdAt: -1 });
apiJournalSchema.index({ tenantId: 1, statusCode: 1, createdAt: -1 });

// TTL: Mongo удаляет документы, у которых expireAt старше JOURNAL_LOG_TTL_SECONDS
apiJournalSchema.index({ expireAt: 1 }, { expireAfterSeconds: JOURNAL_LOG_TTL_SECONDS });

const ApiJournal = mongoose.model<IApiJournal>('ApiJournal', apiJournalSchema);

export default ApiJournal;
