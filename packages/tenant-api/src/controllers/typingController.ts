import { Dialog, DialogMember, User } from '@chat3/models';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/apiAuth.js';

const DEFAULT_TYPING_EXPIRES_MS = 5000;

export async function sendTyping(req: AuthenticatedRequest, res: Response): Promise<void> {
  const routePath = 'post /dialogs/:dialogId/member/:userId/typing';
  const log = (...args: any[]) => {
    console.log(`[${routePath}]`, ...args);
  }
  log('>>>>> start');
  
  try {
    const { dialogId, userId } = req.params;
    const tenantId = req.tenantId!;
    log(`Получены параметры: dialogId=${dialogId}, userId=${userId}, tenantId=${tenantId}`);

    log(`Поиск диалога: dialogId=${dialogId}, tenantId=${tenantId}`);
    const dialog = await Dialog.findOne({
      dialogId,
      tenantId
    }).select('dialogId').lean();

    if (!dialog) {
      log(`Диалог не найден: dialogId=${dialogId}`);
      res.status(404).json({
        error: 'Not Found',
        message: 'Dialog not found'
      });
      return;
    }
    log(`Диалог найден: dialogId=${dialog.dialogId}`);

    log(`Поиск участника: dialogId=${dialogId}, userId=${userId}`);
    const member = await DialogMember.findOne({
      dialogId,
      tenantId,
      userId
    }).select('userId').lean();

    if (!member) {
      log(`Участник не найден: userId=${userId}`);
      res.status(404).json({
        error: 'Not Found',
        message: 'User is not a member of this dialog'
      });
      return;
    }
    log(`Участник найден: userId=${userId}`);

    log(`Получение данных пользователя: userId=${userId}`);
    const user = await User.findOne({
      userId,
      tenantId
    }).lean();

    const userMeta = await metaUtils.getEntityMeta(
      tenantId,
      'user',
      userId
    );

    const actorInfo = sanitizeResponse({
      ...user,
      meta: userMeta
    });

    // Получаем полные данные диалога и его метаданные для события
    const fullDialog = await Dialog.findOne({
      dialogId,
      tenantId
    }).lean();

    if (!fullDialog) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Dialog not found'
      });
      return;
    }

    const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);
    const dialogSection = eventUtils.buildDialogSection({
      dialogId: fullDialog.dialogId,
      tenantId: fullDialog.tenantId,
      createdBy: (fullDialog as any).createdBy,
      createdAt: fullDialog.createdAt,
      meta: dialogMeta || {}
    });

    const typingSection = eventUtils.buildTypingSection({
      userId,
      expiresInMs: DEFAULT_TYPING_EXPIRES_MS,
      timestamp: Date.now(),
      userInfo: actorInfo
    });

    const typingContext = eventUtils.buildEventContext({
      eventType: 'dialog.typing',
      dialogId,
      entityId: dialogId,
      includedSections: ['dialog', 'typing'],
      updatedFields: ['typing']
    });

    log(`Создание события dialog.typing: dialogId=${dialogId}, userId=${userId}`);
    await eventUtils.createEvent({
      tenantId,
      eventType: 'dialog.typing',
      entityType: 'dialog',
      entityId: dialogId,
      actorId: userId,
      actorType: 'user',
      data: eventUtils.composeEventData({
        context: typingContext,
        dialog: dialogSection,
        typing: typingSection
      })
    });

    log(`Отправка успешного ответа: dialogId=${dialogId}, userId=${userId}`);
    res.status(202).json({
      message: 'Typing signal accepted',
      data: {
        dialogId,
        userId,
        expiresInMs: DEFAULT_TYPING_EXPIRES_MS
      }
    });
  } catch (error: any) {
    log(`Ошибка обработки запроса:`, error.message);
    console.error('Error in sendTyping:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  } finally {
    log('>>>>> end');
  }
}

export default {
  sendTyping
};
