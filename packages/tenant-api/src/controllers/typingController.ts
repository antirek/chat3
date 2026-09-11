import {
  sendTyping as sendTypingService,
  isAppServiceError,
  appServiceErrorToHttpStatus,
  appServiceErrorToHttpBody
} from '@chat3/app-services';
import { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/apiAuth.js';

export async function sendTyping(req: AuthenticatedRequest, res: Response): Promise<void> {
  const routePath = 'post /dialogs/:dialogId/member/:userId/typing';
  const log = (...args: any[]) => {
    console.log(`[${routePath}]`, ...args);
  };
  log('>>>>> start');

  try {
    const { dialogId, userId } = req.params;
    const tenantId = req.tenantId!;
    log(`Получены параметры: dialogId=${dialogId}, userId=${userId}, tenantId=${tenantId}`);

    const result = await sendTypingService({ tenantId, dialogId, userId });

    log(`Отправка успешного ответа: dialogId=${result.dialogId}, userId=${result.userId}`);
    res.status(202).json({
      message: 'Typing signal accepted',
      data: {
        dialogId: result.dialogId,
        userId: result.userId,
        expiresInMs: result.expiresInMs
      }
    });
  } catch (error: any) {
    if (isAppServiceError(error)) {
      log(`Ошибка обработки запроса:`, error.message);
      res.status(appServiceErrorToHttpStatus(error)).json(appServiceErrorToHttpBody(error));
      return;
    }
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
