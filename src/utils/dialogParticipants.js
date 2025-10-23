import mongoose from 'mongoose';
import { DialogParticipant } from '../models/index.js';

/**
 * Утилиты для работы с участниками диалогов через модель DialogParticipant
 */

// Добавить участника в диалог
export async function addParticipant(tenantId, dialogId, participantId, role = 'member') {
  try {
    const participant = await DialogParticipant.create({
      tenantId,
      dialogId,
      userId: participantId,
      role,
      isActive: true
    });

    return participant;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error('User is already a participant in this dialog');
    }
    throw new Error(`Failed to add participant: ${error.message}`);
  }
}

// Удалить участника из диалога
export async function removeParticipant(tenantId, dialogId, participantId) {
  try {
    const result = await DialogParticipant.deleteOne({
      tenantId,
      dialogId,
      userId: participantId
    });

    return result.deletedCount > 0;
  } catch (error) {
    throw new Error(`Failed to remove participant: ${error.message}`);
  }
}

// Получить всех участников диалога
export async function getParticipants(tenantId, dialogId) {
  try {
    const participants = await DialogParticipant.find({
      tenantId,
      dialogId
    }).lean();

    return participants.map(p => ({
      id: p._id,
      userId: p.userId,
      role: p.role,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt,
      isActive: p.isActive
    }));
  } catch (error) {
    throw new Error(`Failed to get participants: ${error.message}`);
  }
}

// Проверить, является ли пользователь участником диалога
export async function isParticipant(tenantId, dialogId, participantId) {
  try {
    const count = await DialogParticipant.countDocuments({
      tenantId,
      dialogId,
      userId: participantId,
      isActive: true
    });

    return count > 0;
  } catch (error) {
    throw new Error(`Failed to check participant: ${error.message}`);
  }
}

// Обновить роль участника
export async function updateParticipantRole(tenantId, dialogId, participantId, newRole) {
  try {
    const participant = await DialogParticipant.findOneAndUpdate(
      {
        tenantId,
        dialogId,
        userId: participantId
      },
      {
        role: newRole,
        updatedAt: new Date()
      },
      { new: true }
    );

    return participant;
  } catch (error) {
    throw new Error(`Failed to update participant role: ${error.message}`);
  }
}

// Пометить участника как покинувшего диалог
export async function markParticipantLeft(tenantId, dialogId, participantId) {
  try {
    const participant = await DialogParticipant.findOneAndUpdate(
      {
        tenantId,
        dialogId,
        userId: participantId
      },
      {
        leftAt: new Date(),
        isActive: false,
        updatedAt: new Date()
      },
      { new: true }
    );

    return participant;
  } catch (error) {
    throw new Error(`Failed to mark participant as left: ${error.message}`);
  }
}

// Получить количество участников в диалоге
export async function getParticipantCount(tenantId, dialogId, activeOnly = true) {
  try {
    const query = {
      tenantId,
      dialogId
    };

    if (activeOnly) {
      query.isActive = true;
    }

    return await DialogParticipant.countDocuments(query);
  } catch (error) {
    throw new Error(`Failed to count participants: ${error.message}`);
  }
}

// Получить все диалоги пользователя
export async function getUserDialogs(tenantId, userId) {
  try {
    const participants = await DialogParticipant.find({
      tenantId,
      userId,
      isActive: true
    }).lean();

    return participants.map(p => ({
      dialogId: p.dialogId,
      role: p.role,
      joinedAt: p.joinedAt
    }));
  } catch (error) {
    throw new Error(`Failed to get user dialogs: ${error.message}`);
  }
}

