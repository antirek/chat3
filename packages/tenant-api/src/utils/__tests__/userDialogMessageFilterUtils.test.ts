import {
  messageCreatedAtNumericExpr,
  buildMessageCreatedAtMatchExpr,
  buildMessageCreatedAtDistinctPipeline
} from '../userDialogMessageFilterUtils.js';

describe('userDialogMessageFilterUtils', () => {
  describe('messageCreatedAtNumericExpr', () => {
    test('по умолчанию читает поле $createdAt и покрывает number / string / date', () => {
      const expr = messageCreatedAtNumericExpr();
      expect(expr).toEqual({
        $switch: {
          branches: [
            {
              case: { $in: [{ $type: '$createdAt' }, ['double', 'int', 'long', 'decimal']] },
              then: { $toDouble: '$createdAt' }
            },
            {
              case: { $eq: [{ $type: '$createdAt' }, 'string'] },
              then: {
                $convert: { input: '$createdAt', to: 'double', onError: null, onNull: null }
              }
            },
            {
              case: { $eq: [{ $type: '$createdAt' }, 'date'] },
              then: { $toDouble: { $toLong: '$createdAt' } }
            }
          ],
          default: null
        }
      });
    });

    test('принимает другой путь поля', () => {
      const expr = messageCreatedAtNumericExpr('$foo.bar') as Record<string, any>;
      const sw = expr.$switch;
      expect(sw.branches[0].case).toEqual({
        $in: [{ $type: '$foo.bar' }, ['double', 'int', 'long', 'decimal']]
      });
      expect(sw.branches[0].then).toEqual({ $toDouble: '$foo.bar' });
    });
  });

  describe('buildMessageCreatedAtMatchExpr', () => {
    test('одна нижняя граница в мс: две ветки мс и сек с масштабом /1000', () => {
      const loMs = 1700000000000;
      const expr = buildMessageCreatedAtMatchExpr({ $gte: loMs });
      expect(expr).toEqual({
        $let: {
          vars: {
            n: messageCreatedAtNumericExpr()
          },
          in: {
            $and: [
              { $ne: ['$$n', null] },
              {
                $or: [
                  {
                    $and: [
                      { $gte: ['$$n', 1e12] },
                      { $gte: ['$$n', loMs] }
                    ]
                  },
                  {
                    $and: [
                      { $lt: ['$$n', 1e12] },
                      { $gte: ['$$n', loMs / 1000] }
                    ]
                  }
                ]
              }
            ]
          }
        }
      });
    });

    test('интервал gte+lte: границы сек-ветки делятся на 1000', () => {
      const loMs = 1700000000000;
      const hiMs = 1700003600000;
      const expr = buildMessageCreatedAtMatchExpr({ $gte: loMs, $lte: hiMs });
      const inner = (expr as { $let: { in: { $and: unknown[] } } }).$let.in;
      const orBranches = (inner.$and[1] as { $or: unknown[] }).$or;
      expect(orBranches[1]).toEqual({
        $and: [
          { $lt: ['$$n', 1e12] },
          {
            $and: [{ $gte: ['$$n', loMs / 1000] }, { $lte: ['$$n', hiMs / 1000] }]
          }
        ]
      });
    });
  });

  describe('buildMessageCreatedAtDistinctPipeline', () => {
    test('три стадии: tenantId, $expr по времени, группировка по dialogId', () => {
      const tenantId = 'tnt_unit';
      const createdAt = { $gte: 1700000000000, $lte: 1700003600000 };
      const pipeline = buildMessageCreatedAtDistinctPipeline(tenantId, createdAt);
      expect(pipeline).toHaveLength(3);
      expect(pipeline[0]).toEqual({ $match: { tenantId } });
      expect(pipeline[1]).toEqual({ $match: { $expr: buildMessageCreatedAtMatchExpr(createdAt) } });
      expect(pipeline[2]).toEqual({ $group: { _id: '$dialogId' } });
    });
  });
});
