import axios, { AxiosInstance, AxiosResponse } from 'axios';
import axiosLogger from 'axios-logger';

export interface Chat3ClientOptions {
  baseURL: string;
  apiKey?: string;
  tenantId?: string;
  debug?: boolean;
}

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface TypingSignalResponse {
  status: number;
  data: any;
}

export interface SetMetaOptions {
  dataType?: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

export interface AddDialogMemberOptions {
  type?: string;
  name?: string;
}

export type MessageStatus = 'sent' | 'delivered' | 'read';
export type ReactionAction = 'set' | 'unset';
export type EntityType = 'user' | 'dialog' | 'message' | 'tenant' | 'system' | 'dialogMember';

export class Chat3Client {
  private client: AxiosInstance;

  constructor({ baseURL, apiKey, tenantId, debug }: Chat3ClientOptions) {
    this.client = axios.create({
      baseURL: baseURL,
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId ? tenantId : 'tnt_default',
      },
    });

    // Add API key if provided
    if (apiKey) {
      this.client.defaults.headers.common['x-api-key'] = apiKey;
    }

    // Add logging in development
    if (debug) {
      this.client.interceptors.request.use(
        axiosLogger.requestLogger as any,
        axiosLogger.errorLogger as any,
      );
      this.client.interceptors.response.use(
        axiosLogger.responseLogger as any,
        axiosLogger.errorLogger as any,
      );
    }
  }

  // ==================== DIALOGS ====================

  /**
   * Get all dialogs with filtering
   */
  async getDialogs(params: Record<string, any> = {}): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get('/api/dialogs', { params });
    return response.data;
  }

  /**
   * Create new dialog
   */
  async createDialog(data: Record<string, any>): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.post('/api/dialogs', data);
    return response.data;
  }

  /**
   * Get dialog by ID
   */
  async getDialog(dialogId: string, params: Record<string, any> = {}): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get(`/api/dialogs/${dialogId}`, { params });
    return response.data;
  }

  /**
   * Get dialog members list
   */
  async getDialogMembers(dialogId: string, params: Record<string, any> = {}): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get(`/api/dialogs/${dialogId}/members`, { params });
    return response.data;
  }

  /**
   * Delete dialog
   */
  async deleteDialog(dialogId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.delete(`/api/dialogs/${dialogId}`);
    return response.data;
  }

  /**
   * Get user's dialogs with pagination
   */
  async getUserDialogs(userId: string, params: Record<string, any> = {}): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get(`/api/users/${userId}/dialogs`, { params });
    return response.data;
  }

  // ==================== MESSAGES ====================

  /**
   * Get messages for a dialog
   */
  async getDialogMessages(dialogId: string, params: Record<string, any> = {}): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get(`/api/dialogs/${dialogId}/messages`, { params });
    return response.data;
  }

  /**
   * Get messages for a dialog in user context
   * Returns messages with user-specific context data
   * Note: Messages include statuses array with all participants' statuses
   */
  async getUserDialogMessages(userId: string, dialogId: string, params: Record<string, any> = {}): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get(`/api/users/${userId}/dialogs/${dialogId}/messages`, { params });
    return response.data;
  }

  /**
   * Create new message in dialog
   */
  async createMessage(dialogId: string, data: Record<string, any>): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.post(`/api/dialogs/${dialogId}/messages`, data);
    return response.data;
  }

  /**
   * Get message by ID
   */
  async getMessage(messageId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get(`/api/messages/${messageId}`);
    return response.data;
  }

  /**
   * Get single message in context of specific user
   * GET /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}
   */
  async getUserMessage(userId: string, dialogId: string, messageId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get(`/api/users/${userId}/dialogs/${dialogId}/messages/${messageId}`);
    return response.data;
  }

  /**
   * Update message content
   * PUT /api/messages/{messageId}
   */
  async updateMessage(messageId: string, data: Record<string, any>): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.put(`/api/messages/${messageId}`, data);
    return response.data;
  }

  /**
   * Get all messages with filtering
   */
  async getMessages(params: Record<string, any> = {}): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get('/api/messages', { params });
    return response.data;
  }

  // ==================== DIALOG MEMBERS ====================

  /**
   * Add member to dialog
   * @param dialogId - Dialog ID
   * @param userId - User ID
   * @param options - Optional: type, name
   */
  async addDialogMember(dialogId: string, userId: string, options: AddDialogMemberOptions = {}): Promise<ApiResponse> {
    const payload: Record<string, any> = {
      userId,
      ...(options.type && { type: options.type }),
      ...(options.name && { name: options.name }),
    };
    const response: AxiosResponse<ApiResponse> = await this.client.post(`/api/dialogs/${dialogId}/members/add`, payload);
    return response.data;
  }

  /**
   * Remove member from dialog
   */
  async removeDialogMember(dialogId: string, userId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.post(`/api/dialogs/${dialogId}/members/${userId}/remove`);
    return response.data;
  }

  /**
   * Update unread counter for dialog member
   */
  async updateDialogMemberUnread(dialogId: string, userId: string, data: Record<string, any> = {}): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.patch(
      `/api/dialogs/${dialogId}/members/${userId}/unread`,
      data,
    );
    return response.data;
  }

  // ==================== MESSAGE STATUS ====================

  /**
   * Update message status (read/delivered)
   * Legacy method - uses old endpoint format
   * @deprecated Use updateMessageStatusInContext instead
   */
  async updateMessageStatus(messageId: string, userId: string, status: MessageStatus): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.post(`/api/messages/${messageId}/status/${userId}/${status}`);
    return response.data;
  }

  /**
   * Create new message status entry (add to history)
   * POST /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/status/{status}
   */
  async updateMessageStatusInContext(userId: string, dialogId: string, messageId: string, status: MessageStatus): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.post(
      `/api/users/${userId}/dialogs/${dialogId}/messages/${messageId}/status/${status}`,
    );
    return response.data;
  }

  /**
   * Get paginated list of all message statuses (history)
   * GET /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/statuses
   */
  async getMessageStatuses(userId: string, dialogId: string, messageId: string, params: Record<string, any> = {}): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get(
      `/api/users/${userId}/dialogs/${dialogId}/messages/${messageId}/statuses`,
      { params },
    );
    return response.data;
  }

  // ==================== REACTIONS ====================

  /**
   * Get reactions for a message
   * Legacy method - uses old endpoint format
   * @deprecated Use getMessageReactionsInContext instead
   */
  async getMessageReactions(messageId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get(`/api/messages/${messageId}/reactions`);
    return response.data;
  }

  /**
   * Get all reactions for a message
   * GET /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/reactions
   */
  async getMessageReactionsInContext(userId: string, dialogId: string, messageId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get(
      `/api/users/${userId}/dialogs/${dialogId}/messages/${messageId}/reactions`,
    );
    return response.data;
  }

  /**
   * Add or update reaction
   * Legacy method - uses old endpoint format
   * @deprecated Use setReaction instead
   */
  async addReaction(messageId: string, data: Record<string, any>): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.post(`/api/messages/${messageId}/reactions`, data);
    return response.data;
  }

  /**
   * Set or unset reaction for a message
   * POST /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/reactions/{action}
   * @param userId - User ID
   * @param dialogId - Dialog ID
   * @param messageId - Message ID
   * @param action - Action: 'set' or 'unset'
   * @param reaction - Reaction emoji/action (e.g., '👍', '❤️')
   */
  async setReaction(userId: string, dialogId: string, messageId: string, action: ReactionAction, reaction: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.post(
      `/api/users/${userId}/dialogs/${dialogId}/messages/${messageId}/reactions/${action}`,
      { reaction }
    );
    return response.data;
  }

  /**
   * Send typing indicator for user in dialog
   */
  async sendTypingSignal(dialogId: string, userId: string): Promise<TypingSignalResponse> {
    const response = await this.client.post(`/api/dialogs/${dialogId}/member/${userId}/typing`);
    return {
      status: response.status,
      data: response.data,
    };
  }

  /**
   * Remove reaction
   * Legacy method - reactions are now toggled via setReaction
   * @deprecated Use setReaction to toggle reaction off
   */
  async removeReaction(messageId: string, reaction: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.delete(`/api/messages/${messageId}/reactions/${reaction}`);
    return response.data;
  }

  // ==================== USERS ====================

  /**
   * Get all users
   * GET /api/users
   */
  async getUsers(params: Record<string, any> = {}): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get('/api/users', { params });
    return response.data;
  }

  /**
   * Create user in Chat3
   */
  async createUser(userId: string, data: Record<string, any>): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.post(`/api/users`, {
      userId,
      ...data,
    });
    return response.data;
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get(`/api/users/${userId}`);
    return response.data;
  }

  /**
   * Update user
   */
  async updateUser(userId: string, data: Record<string, any>): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.put(`/api/users/${userId}`, data);
    return response.data;
  }

  /**
   * Delete user
   * DELETE /api/users/{userId}
   */
  async deleteUser(userId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.delete(`/api/users/${userId}`);
    return response.data;
  }

  /**
   * Set user meta key
   * Note: Use getUser() to get user with meta tags (if included in response)
   * @deprecated Use setMeta('user', userId, key, data) instead
   */
  async setUserMeta(userId: string, key: string, data: Record<string, any>): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.put(`/api/users/${userId}/meta/${key}`, data);
    return response.data;
  }

  /**
   * Delete user meta key
   * @deprecated Use deleteMeta('user', userId, key) instead
   */
  async deleteUserMeta(userId: string, key: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.delete(`/api/users/${userId}/meta/${key}`);
    return response.data;
  }

  // ==================== TENANTS ====================

  /**
   * Get all tenants
   * GET /api/tenants
   */
  async getTenants(params: Record<string, any> = {}): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get('/api/tenants', { params });
    return response.data;
  }

  /**
   * Get tenant by ID
   * GET /api/tenants/{tenantId}
   */
  async getTenant(tenantId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.get(`/api/tenants/${tenantId}`);
    return response.data;
  }

  /**
   * Create new tenant
   * POST /api/tenants
   */
  async createTenant(data: Record<string, any> = {}): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.post('/api/tenants', data);
    return response.data;
  }

  /**
   * Delete tenant
   * DELETE /api/tenants/{tenantId}
   */
  async deleteTenant(tenantId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.client.delete(`/api/tenants/${tenantId}`);
    return response.data;
  }

  // ==================== META ====================

  /**
   * Get meta for entity
   * GET /api/meta/{entityType}/{entityId} - Get all meta tags
   * Note: API does not support getting a single key via GET. Use setMeta/getMeta to work with individual keys.
   * @param entityType - Entity type (user, dialog, message, tenant, system, dialogMember)
   * @param entityId - Entity ID (for dialogMember use format: dialogId:userId)
   * @param key - Optional: specific key to filter (not supported by API, will be ignored)
   * @param params - Optional query parameters
   */
  async getMeta(entityType: EntityType, entityId: string, key: string | null = null, params: Record<string, any> = {}): Promise<ApiResponse> {
    // API only supports GET /meta/{entityType}/{entityId} to get all meta tags
    // If key is provided, it's ignored - client should filter the result
    const path = `/api/meta/${entityType}/${entityId}`;
    const response: AxiosResponse<ApiResponse> = await this.client.get(path, { params });
    
    // If key is specified, return only that key's value
    if (key && response.data && (response.data as any).data) {
      const allMeta = (response.data as any).data;
      return {
        ...response.data,
        data: allMeta[key] || null
      } as ApiResponse;
    }
    
    return response.data;
  }

  /**
   * Set meta for entity
   * PUT /api/meta/{entityType}/{entityId}/{key}
   * @param entityType - Entity type (user, dialog, message, tenant, system, dialogMember)
   * @param entityId - Entity ID (for dialogMember use format: dialogId:userId)
   * @param key - Meta key
   * @param value - Meta value (string, number, boolean, object, array)
   * @param options - Optional: dataType
   */
  async setMeta(
    entityType: EntityType, 
    entityId: string, 
    key: string, 
    value: any, 
    options: SetMetaOptions = {}
  ): Promise<ApiResponse> {
    // Use entityId as-is - Axios will handle URL encoding automatically
    // For dialogMember, entityId should be in format: dialogId:userId
    
    // Если value - это объект и содержит поле value, значит передали старый формат
    // Поддерживаем обратную совместимость
    let payload: Record<string, any>;
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'value' in value) {
      // Старый формат: setMeta(type, id, key, { value: ..., dataType: ... })
      payload = {
        value: (value as any).value,
        dataType: (value as any).dataType || options.dataType || 'string'
      };
    } else {
      // Новый формат: setMeta(type, id, key, value, { dataType: ... })
      payload = {
        value: value
      };
      if (options.dataType) {
        payload.dataType = options.dataType;
      }
    }

    const response: AxiosResponse<ApiResponse> = await this.client.put(
      `/api/meta/${entityType}/${entityId}/${key}`,
      payload,
    );
    return response.data;
  }

  /**
   * Delete meta key
   */
  async deleteMeta(entityType: EntityType, entityId: string, key: string, params: Record<string, any> = {}): Promise<ApiResponse> {
    // Use entityId as-is - Axios will handle URL encoding automatically
    // For dialogMember, entityId should be in format: dialogId:userId
    const response: AxiosResponse<ApiResponse> = await this.client.delete(
      `/api/meta/${entityType}/${entityId}/${key}`,
      { params },
    );
    return response.data;
  }
}

export default Chat3Client;

// Для обратной совместимости с CommonJS
module.exports = {
  Chat3Client,
  default: Chat3Client,
};
