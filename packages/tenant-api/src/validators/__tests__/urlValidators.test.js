import { jest } from '@jest/globals';

import {
  validateDialogId,
  validateMessageId,
  validateTopicId,
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

  test('validateTopicId accepts valid topicId', () => {
    const req = { params: { topicId: 'topic_abcdefghij1234567890' } };
    const res = createRes();
    const next = jest.fn();

    validateTopicId(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('validateTopicId rejects invalid format', () => {
    const req = { params: { topicId: 'invalid' } };
    const res = createRes();
    const next = jest.fn();

    validateTopicId(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.field).toBe('topicId');
  });

  test('validateTopicId rejects missing param', () => {
    const req = { params: { dialogId: 'dlg_1234567890abcdefghij' } };
    const res = createRes();
    const next = jest.fn();

    validateTopicId(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.field).toBe('topicId');
  });

    test('validateUserId rejects userId with dot', () => {
      const req = { params: { userId: 'user.ewrjdpfp3254ds' } };
      const res = createRes();
      const next = jest.fn();

      validateUserId(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toBe('userId не может содержать точку');
      expect(res.body.field).toBe('userId');
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

  test('validateStatus accepts valid format (read, error2)', () => {
    const req1 = { params: { status: 'read' } };
    const res1 = createRes();
    const next1 = jest.fn();
    validateStatus(req1, res1, next1);
    expect(next1).toHaveBeenCalled();

    const req2 = { params: { status: 'error2' } };
    const res2 = createRes();
    const next2 = jest.fn();
    validateStatus(req2, res2, next2);
    expect(next2).toHaveBeenCalled();
  });

  test('validateStatus rejects invalid format (forbidden characters)', () => {
    const req = { params: { status: 'error!' } };
    const res = createRes();
    const next = jest.fn();

    validateStatus(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.field).toBe('status');
    expect(res.body.received).toBe('error!');
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

  test('validateMetaKey enforces allowed characters (letters, numbers, underscore)', () => {
    const req = { params: { key: 'allowed_key_1' } };
    const res = createRes();
    const next = jest.fn();

    validateMetaKey(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('validateMetaKey rejects key with dot', () => {
    const req = { params: { key: 'contact.phone' } };
    const res = createRes();
    const next = jest.fn();

    validateMetaKey(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.field).toBe('key');
    expect(res.body.message).toMatch(/no dots|underscore/);
  });

  test('validateMetaKey rejects hyphen (only underscore allowed)', () => {
    const req = { params: { key: 'contact-phone' } };
    const res = createRes();
    const next = jest.fn();

    validateMetaKey(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
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


