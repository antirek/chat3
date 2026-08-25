import { JOURNAL_LOG_TTL_SECONDS } from '../journalLogTtl.js';
import ApiJournal from '../ApiJournal.js';

describe('journal log TTL (#15522 / FDR-0002)', () => {
  it('exports 60-day retention constant', () => {
    expect(JOURNAL_LOG_TTL_SECONDS).toBe(60 * 24 * 3600);
    expect(JOURNAL_LOG_TTL_SECONDS).toBe(5184000);
  });

  it('declares TTL index on ApiJournal.expireAt (BSON Date)', () => {
    const indexes = ApiJournal.schema.indexes();
    const ttlIndex = indexes.find(
      ([fields, options]) =>
        fields.expireAt === 1 &&
        options &&
        (options as { expireAfterSeconds?: number }).expireAfterSeconds === JOURNAL_LOG_TTL_SECONDS
    );
    expect(ttlIndex).toBeDefined();

    const expireAtPath = ApiJournal.schema.path('expireAt');
    expect(expireAtPath).toBeDefined();
    expect(expireAtPath.instance).toBe('Date');
  });
});
