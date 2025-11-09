import { jest } from '@jest/globals';

import {
  validateDialogId,
  validateMessageId,
  validateUserId,
  validateStatus,
  validateReaction,
  validateEntityType,
  validateEntityId,
  validateMetaKey
} from '../urlValidators/index.js';

const createRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

describe('urlValidators', () => {
  test('validateDialogId accepts valid dialogId and normalizes id param', () => {
    const req = { params: { id: 'dlg_1234567890abcdefghij' } };
    const res = createRes();
    const next = jest.fn();

    validateDialogId(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.params.dialogId).toBe('dlg_1234567890abcdefghij');
  });

  test('validateDialogId rejects invalid format', () => {
    const req = { params: { dialogId: 'invalid' } };
    const res = createRes();
    const next = jest.fn();

    validateDialogId(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.field).toBe('dialogId');
  });

  test('validateMessageId requires proper prefix', () => {
    const req = { params: { messageId: 'msg_abcdefghij1234567890' } };
    const res = createRes();
    const next = jest.fn();

    validateMessageId(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('validateMessageId rejects missing param', () => {
    const req = { params: {} };
    const res = createRes();
    const next = jest.fn();

    validateMessageId(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  test('validateUserId ensures non-empty string', () => {
    const req = { params: { userId: '' } };
    const res = createRes();
    const next = jest.fn();

    validateUserId(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.field).toBe('userId');
  });

  test('validateStatus enforces allowed values', () => {
    const req = { params: { status: 'read' } };
    const res = createRes();
    const next = jest.fn();

    validateStatus(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('validateStatus rejects unknown status', () => {
    const req = { params: { status: 'archived' } };
    const res = createRes();
    const next = jest.fn();

    validateStatus(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.received).toBe('archived');
  });

  test('validateReaction limits length', () => {
    const req = { params: { reaction: '👍'.repeat(60) } };
    const res = createRes();
    const next = jest.fn();

    validateReaction(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  test('validateEntityType enforces allowlist', () => {
    const req = { params: { entityType: 'dialog' } };
    const res = createRes();
    const next = jest.fn();

    validateEntityType(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('validateEntityType rejects unsupported type', () => {
    const req = { params: { entityType: 'channel' } };
    const res = createRes();
    const next = jest.fn();

    validateEntityType(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.received).toBe('channel');
  });

  test('validateEntityId requires non-empty string', () => {
    const req = { params: { entityId: '   ' } };
    const res = createRes();
    const next = jest.fn();

    validateEntityId(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  test('validateMetaKey enforces allowed characters', () => {
    const req = { params: { key: 'allowed_key-1' } };
    const res = createRes();
    const next = jest.fn();

    validateMetaKey(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('validateMetaKey rejects forbidden characters', () => {
    const req = { params: { key: 'invalid key!' } };
    const res = createRes();
    const next = jest.fn();

    validateMetaKey(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.field).toBe('key');
  });
});


