<template>
  <div class="user-dialogs-page">
    <div class="container">
      <!-- Пользователи -->
      <div class="panel users-panel">
        <div class="panel-header">
          <div class="header-left">
            <span>👥 Пользователи</span>
          </div>
          <div class="header-right">
            <button @click="showUsersUrl" class="url-button" title="Показать URL запроса">🔗 URL</button>
          </div>
        </div>
        <div class="filter-form" style="border-bottom: 1px solid #e9ecef;">
          <div class="form-section">
            <label for="userFilterInput">🔍 Фильтр пользователей (формат: <code>(поле,оператор,значение)</code>)</label>
            <select
              id="userFilterExample"
              v-model="selectedUserFilterExample"
              @change="selectUserFilterExample"
              style="margin-bottom: 8px;"
            >
              <option value="">Выберите пример</option>
              <optgroup label="Поле userId">
                <option value="(userId,regex,carl)">userId содержит "carl"</option>
                <option value="(userId,regex,bot)">userId содержит "bot"</option>
                <option value="(userId,eq,system_bot)">userId = system_bot</option>
              </optgroup>
              <optgroup label="Поле name">
                <option value="(name,regex,Alice)">Имя содержит "Alice"</option>
                <option value="(name,regex,Marta)">Имя содержит "Marta"</option>
              </optgroup>
              <optgroup label="Мета-теги (meta.*)">
                <option value="(meta.role,eq,manager)">meta.role = manager</option>
                <option value="(meta.region,regex,europe)">meta.region содержит "europe"</option>
              </optgroup>
              <option value="custom">Пользовательский фильтр</option>
            </select>
            <div class="input-with-clear">
              <input
                type="text"
                id="userFilterInput"
                v-model="userFilterInput"
                placeholder="Например: (userId,regex,carl)&(meta.role,eq,manager)"
              />
              <button class="clear-field" type="button" @click="clearUserFilter" title="Очистить поле">✕</button>
            </div>
            <small style="display: block; margin-top: 6px; color: #6c757d;">
              Поддерживаются поля `userId`, `name`, а также `meta.*`. Операторы: eq, regex, in, nin, gt, gte, lt, lte, ne и др.
            </small>
          </div>
          <div class="form-actions" style="margin-top: 8px; justify-content: flex-end;">
            <button class="btn-primary" type="button" @click="applyUserFilter">Применить</button>
          </div>
        </div>
        <div class="pagination" id="usersPagination" v-show="totalUsers > 0">
          <div class="pagination-info" id="usersPaginationInfo">
            {{ userPaginationStart }}-{{ userPaginationEnd }} из {{ totalUsers }}
          </div>
          <div class="pagination-controls">
            <button
              class="btn-secondary btn-small"
              @click="goToUsersFirstPage"
              :disabled="currentUserPage <= 1"
              title="Первая страница"
            >
              ⏮
            </button>
            <button
              class="btn-secondary btn-small"
              @click="goToUsersPreviousPage"
              :disabled="currentUserPage <= 1"
              title="Предыдущая страница"
            >
              ◀
            </button>
            <span>Стр.</span>
            <input
              type="number"
              id="currentUserPageInput"
              v-model.number="currentUserPageInput"
              :min="1"
              :max="totalUserPages"
              @change="goToUsersPage(currentUserPageInput)"
            />
            <span>из</span>
            <span id="totalUserPages">{{ totalUserPages }}</span>
            <button
              class="btn-secondary btn-small"
              @click="goToUsersNextPage"
              :disabled="currentUserPage >= totalUserPages"
              title="Следующая страница"
            >
              ▶
            </button>
            <button
              class="btn-secondary btn-small"
              @click="goToUsersLastPage"
              :disabled="currentUserPage >= totalUserPages"
              title="Последняя страница"
            >
              ⏭
            </button>
            <span style="margin-left: 8px;">Показ:</span>
            <select id="userPageLimit" v-model.number="currentUserLimit" @change="changeUserLimit(currentUserLimit)">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </div>
        </div>
        <div class="panel-content" id="usersList">
          <div v-if="loadingUsers" class="loading">Загрузка пользователей...</div>
          <div v-else-if="usersError" class="error">Ошибка: {{ usersError }}</div>
          <div v-else-if="users.length === 0" class="no-data">Пользователи не найдены</div>
          <table v-else>
            <thead>
              <tr>
                <th>User ID</th>
                <th style="text-align: center; width: 80px;" title="Общее количество диалогов">💬 Диалоги</th>
                <th style="text-align: center; width: 80px;" title="Диалоги с непрочитанными сообщениями">🔔 Непрочитано</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="user in users"
                :key="user.userId"
                @click="selectUser(user.userId, user.displayName || user.userId)"
                :class="['user-row', { 'user-row-selected': currentUserId === user.userId }]"
                :data-user-id="user.userId"
                :title="`Диалогов: ${user.dialogCount || 0}, Непрочитано: ${user.unreadDialogsCount || 0}`"
                style="cursor: pointer;"
              >
                <td>{{ user.userId }}</td>
                <td style="text-align: center;" @click.stop>
                  <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #495057;">
                    {{ user.dialogCount !== undefined ? user.dialogCount : '-' }}
                  </span>
                </td>
                <td style="text-align: center;" @click.stop>
                  <span :style="{
                    background: user.unreadDialogsCount > 0 ? '#fff3cd' : '#f0f0f0',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: user.unreadDialogsCount > 0 ? '#856404' : '#495057'
                  }">
                    {{ user.unreadDialogsCount !== undefined ? user.unreadDialogsCount : '-' }}
                  </span>
                </td>
                <td class="actions-column" @click.stop>
                  <button class="info-button" @click="showUserInfoModal(user.userId)">ℹ️ Инфо</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Диалоги -->
      <div class="panel dialogs-panel">
        <div class="panel-header">
          <div class="header-left">
            <span>💬 Диалоги{{ currentUserName ? ` пользователя ${currentUserName}` : '' }}</span>
          </div>
          <div class="header-right">
            <button
              id="viewUrlBtn"
              class="view-url-btn"
              @click="showCurrentUrl"
              title="Просмотреть текущий URL запроса"
            >
              🔗 URL
            </button>
          </div>
        </div>
        <div class="filter-form" id="dialogsFilterForm" v-show="currentUserId">
          <div class="form-section">
            <label for="filterExample">🔍 Фильтр:</label>
            <select id="filterExample" v-model="selectedFilterExample" @change="selectFilterExample">
              <option value="">Выберите пример фильтра</option>
              <optgroup label="Фильтры по участникам">
                <option value="(member,in,[carl])">👥 С участником: carl</option>
                <option value="(member,in,[marta])">👥 С участником: marta</option>
                <option value="(member,in,[alice])">👥 С участником: alice</option>
                <option value="(member,in,[bob])">👥 С участником: bob</option>
                <option value="(member,in,[sara])">👥 С участником: sara</option>
                <option value="(member,in,[kirk])">👥 С участником: kirk</option>
                <option value="(member,in,[john])">👥 С участником: john</option>
                <option value="(member,in,[eve])">👥 С участником: eve</option>
                <option value="(member,in,[carl,marta])">👥 С участниками: carl или marta</option>
                <option value="(member,all,[carl,marta])">👥 Со всеми участниками: carl и marta</option>
                <option value="(member,ne,carl)">👥 БЕЗ участника: carl</option>
              </optgroup>
              <optgroup label="Фильтры по meta">
                <option value="(meta.channelType,eq,whatsapp)">meta. Тип канала = whatsapp</option>
                <option value="(meta.channelType,eq,telegram)">meta. Тип канала = telegram</option>
                <option value="(meta.type,eq,internal)">meta. Тип диалога = internal</option>
                <option value="(meta.type,eq,external)">meta. Тип диалога = external</option>
                <option value="(meta.securityLevel,eq,high)">meta. Уровень безопасности = high</option>
              </optgroup>
              <option value="custom">Пользовательский фильтр</option>
            </select>
            <div class="input-with-clear">
              <input
                type="text"
                id="filterValue"
                v-model="filterValue"
                placeholder="Введите или выберите фильтр"
              />
              <button class="clear-field" @click="clearFilter" title="Очистить фильтр">✕</button>
            </div>
          </div>
          <div class="form-actions" style="justify-content: flex-end;">
            <button @click="applyFilter" class="btn-primary">Применить</button>
          </div>
        </div>
        <div class="pagination" id="dialogsPagination" v-show="showDialogsPagination">
          <div class="pagination-info">
            Страница {{ currentDialogPage }} из {{ totalDialogPages }} (всего {{ totalDialogs }} диалогов)
          </div>
          <div class="pagination-controls">
            <button @click="changeDialogPage(currentDialogPage - 1)" :disabled="currentDialogPage <= 1">
              ← Предыдущая
            </button>
            <button
              v-for="pageNum in visibleDialogPages"
              :key="pageNum"
              :class="{ active: pageNum === currentDialogPage }"
              @click="changeDialogPage(pageNum)"
            >
              {{ pageNum }}
            </button>
            <button
              @click="changeDialogPage(currentDialogPage + 1)"
              :disabled="currentDialogPage >= totalDialogPages"
            >
              Следующая →
            </button>
          </div>
        </div>
        <div class="panel-content" id="dialogsList">
          <div v-if="!currentUserId" class="placeholder">Выберите пользователя</div>
          <div v-else-if="loadingDialogs" class="loading">Загрузка диалогов...</div>
          <div v-else-if="dialogsError" class="error">Ошибка: {{ dialogsError }}</div>
          <div v-else-if="dialogs.length === 0" class="no-data">Диалоги не найдены</div>
          <table v-else>
            <thead>
              <tr>
                <th>Dialog ID</th>
                <th>Unread</th>
                <th style="text-align: center;">📌 Топики</th>
                <th>Последний просмотр</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="dialog in dialogs"
                :key="dialog.dialogId"
                @click="selectDialog(dialog.dialogId)"
                :class="['dialog-row', { 'dialog-row-selected': currentDialogId === dialog.dialogId }]"
                :data-dialog-id="dialog.dialogId"
              >
                <td>{{ shortenDialogId(dialog.dialogId) }}</td>
                <td>{{ dialog.context?.unreadCount || 0 }}</td>
                <td style="text-align: center;">
                  <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #495057;">
                    {{ dialog.stats?.topicCount || 0 }}
                  </span>
                </td>
                <td>{{ formatLastSeen(dialog.context?.lastSeenAt) }}</td>
                <td class="actions-column">
                  <button class="info-button" @click.stop="showDialogInfo(dialog.dialogId)">ℹ️ Инфо</button>
                  <button class="action-button events-button" @click.stop="showDialogEventsModal(dialog.dialogId)">📋 События</button>
                  <button class="btn-success btn-small" @click.stop="showDialogMetaModal(dialog.dialogId)">🏷️ Мета</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Сообщения / Участники / Топики -->
      <div class="panel messages-panel">
        <!-- Вкладки -->
        <div v-if="currentDialogId" class="tabs-container">
          <button
            class="tab-button"
            :class="{ active: currentViewMode === 'messages' }"
            @click="selectDialog(currentDialogId!)"
          >
            📝 Сообщения
          </button>
          <button
            class="tab-button"
            :class="{ active: currentViewMode === 'members' }"
            @click="selectDialogMembers(currentDialogId!)"
          >
            👥 Участники
          </button>
          <button
            class="tab-button"
            :class="{ active: currentViewMode === 'topics' }"
            @click="selectDialogTopics(currentDialogId!)"
          >
            📌 Топики
          </button>
        </div>
        <div class="panel-header">
          <div class="header-left">
            <button
              v-if="currentDialogId && currentViewMode === 'messages'"
              @click="showAddMessageModal"
              class="url-button"
              title="Добавить сообщение"
              id="addMessageBtn"
            >
              ➕ Добавить
            </button>
            <button
              v-if="currentDialogId && currentViewMode === 'members'"
              @click="showAddMemberModal"
              class="url-button"
              title="Добавить участника"
              id="addMemberBtn"
            >
              ➕ Добавить
            </button>
            <button
              v-if="currentDialogId && currentViewMode === 'topics'"
              @click="showAddTopicModal"
              class="url-button"
              title="Создать топик"
              id="addTopicBtn"
            >
              ➕ Создать
            </button>
          </div>
          <div class="header-right">
            <button
              v-if="currentDialogId && currentViewMode === 'messages'"
              @click="showCurrentMessageUrl"
              class="url-button"
              title="Показать URL запроса"
              id="messageUrlBtn"
            >
              🔗 URL
            </button>
            <button
              v-if="currentDialogId && currentViewMode === 'members'"
              @click="showMembersUrlModal"
              class="url-button"
              title="Показать URL API"
              id="membersUrlBtn"
            >
              🔗 URL
            </button>
            <button
              v-if="currentDialogId && currentViewMode === 'topics'"
              @click="showTopicsUrlModal"
              class="url-button"
              title="Показать URL API"
              id="topicsUrlBtn"
            >
              🔗 URL
            </button>
          </div>
        </div>
        <div class="filter-form" id="messagesFilterForm" v-show="currentDialogId && currentViewMode === 'messages'">
          <div class="form-section">
            <label for="messageFilterExample">🔍 Фильтр сообщений:</label>
            <select id="messageFilterExample" v-model="selectedMessageFilterExample" @change="selectMessageFilterExample">
              <option value="">Выберите пример фильтра</option>
              <option value="(content,regex,встретимся)">📝 Содержит "встретимся"</option>
              <option value="(content,regex,спасибо)">📝 Содержит "спасибо"</option>
              <option value="(type,eq,internal.text)">📝 Тип = internal.text</option>
              <option value="(type,eq,system)">📝 Тип = system</option>
              <option value="(senderId,eq,carl)">👤 Отправитель = carl</option>
              <option value="(senderId,eq,sara)">👤 Отправитель = sara</option>
              <option value="custom">Пользовательский фильтр</option>
            </select>
            <div class="input-with-clear">
              <input
                type="text"
                id="messageFilterInput"
                v-model="messageFilterInput"
                placeholder="Введите или выберите фильтр сообщений"
              />
              <button type="button" class="clear-field" @click="clearMessageFilter">✕</button>
            </div>
          </div>
          <div class="form-actions">
            <button @click="applyMessageFilter" class="btn-primary">Применить</button>
          </div>
        </div>
        <!-- Сообщения -->
        <div class="panel-content" id="messagesList" v-show="currentViewMode === 'messages'">
          <div class="pagination" id="messagesPagination" v-show="showMessagesPagination" style="padding: 15px 20px; border-bottom: 1px solid #e9ecef;">
            <div class="pagination-info">
              Страница {{ currentMessagePage }} из {{ totalMessagePages }} (всего {{ totalMessages }} сообщений)
            </div>
            <div class="pagination-controls">
              <button @click="changeMessagePage(currentMessagePage - 1)" :disabled="currentMessagePage <= 1">
                ← Предыдущая
              </button>
              <button
                v-for="pageNum in visibleMessagePages"
                :key="pageNum"
                :class="{ active: pageNum === currentMessagePage }"
                @click="changeMessagePage(pageNum)"
              >
                {{ pageNum }}
              </button>
              <button
                @click="changeMessagePage(currentMessagePage + 1)"
                :disabled="currentMessagePage >= totalMessagePages"
              >
                Следующая →
              </button>
            </div>
          </div>
          <div v-if="!currentDialogId" class="placeholder">Выберите диалог</div>
          <div v-else-if="loadingMessages" class="loading">Загрузка сообщений...</div>
          <div v-else-if="messagesError" class="error">Ошибка: {{ messagesError }}</div>
          <div v-else-if="messages.length === 0" class="no-data">Сообщения не найдены</div>
          <table v-else>
            <thead>
              <tr>
                <th>Отправитель</th>
                <th>Время</th>
                <th>Содержимое</th>
                <th>Статус</th>
                <th>Инфо</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="message in messages"
                :key="message.messageId"
                :data-message-id="message.messageId"
                :style="message.context?.isMine ? 'background-color: #f0f8ff;' : ''"
              >
                <td>
                  {{ message.senderId }}
                  <span v-if="message.context?.isMine" style="color: #4fc3f7; margin-left: 5px;" title="Ваше сообщение">👤</span>
                </td>
                <td>{{ formatMessageTime(message.createdAt) }}</td>
                <td class="message-content">{{ message.content }}</td>
                <td>
                  <span
                    v-if="message.context?.isMine && getMessageStatus(message)"
                    :style="{ color: getStatusColor(getMessageStatus(message)), fontWeight: 'bold' }"
                    :title="getMessageStatus(message) || undefined"
                  >
                    {{ getStatusIcon(getMessageStatus(message)) }}
                  </span>
                  <span v-else style="color: #999;">-</span>
                </td>
                <td class="actions-column">
                  <button class="info-button" @click="showMessageInfo(message.messageId)">ℹ️ Инфо</button>
                  <button class="btn-success btn-small" @click="showMessageMetaModal(message.messageId)">🏷️ Мета</button>
                  <button class="action-button reactions-button" @click="showReactionModal(message.messageId)">😊 Реакции</button>
                  <button class="action-button events-button" @click="showEventsModal(message.messageId)">📋 События</button>
                  <button class="action-button status-matrix-button" @click="showStatusMatrixModal(message.messageId)">📊 Матрица статусов</button>
                  <button class="action-button statuses-button" @click="showStatusesModal(message.messageId)">📋 Статусы</button>
                  <button class="action-button set-status-button" @click="showSetStatusModal(message.messageId)">✏️ Установить статус</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Топики -->
        <div id="topicsPanelContent" v-show="currentViewMode === 'topics'" style="flex: 1; flex-direction: column; overflow: hidden;">
          <div id="topicsListSectionPanel" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 15px 20px;">
            <div v-if="loadingTopics" class="loading">Загрузка топиков...</div>
            <div v-else-if="topicsError" class="error">Ошибка: {{ topicsError }}</div>
            <div v-else-if="topics.length === 0" class="no-data">Топики не найдены</div>
            <table v-else>
              <thead>
                <tr>
                  <th>Topic ID</th>
                  <th>Unread</th>
                  <th>Meta</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="topic in topics" :key="topic.topicId">
                  <td :title="topic.topicId">{{ shortenTopicId(topic.topicId) }}</td>
                  <td style="text-align: center;">
                    <span v-if="topic.unreadCount > 0" style="color: #dc3545; font-weight: bold;">{{ topic.unreadCount }}</span>
                    <span v-else style="color: #6c757d;">0</span>
                  </td>
                  <td>
                    <pre v-if="topic.meta && Object.keys(topic.meta).length > 0" style="margin: 0; font-size: 11px; max-width: 400px; overflow-x: auto; white-space: pre-wrap;">{{ JSON.stringify(topic.meta, null, 2) }}</pre>
                    <span v-else style="color: #adb5bd;">—</span>
                  </td>
                  <td class="actions-column">
                    <button
                      v-if="currentDialogId"
                      class="btn-success btn-small"
                      @click="showTopicMetaModal(currentDialogId, topic.topicId)"
                    >
                      🏷️ Мета
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="totalTopicsPages > 1" class="pagination" style="margin-top: 15px;">
              <button @click="loadDialogTopics(currentDialogId!, currentTopicsPage - 1)" :disabled="currentTopicsPage <= 1">
                ← Назад
              </button>
              <span>Страница {{ currentTopicsPage }} из {{ totalTopicsPages }}</span>
              <button @click="loadDialogTopics(currentDialogId!, currentTopicsPage + 1)" :disabled="currentTopicsPage >= totalTopicsPages">
                Вперёд →
              </button>
            </div>
          </div>
        </div>

        <!-- Участники -->
        <div id="membersPanelContent" v-show="currentViewMode === 'members'" style="flex: 1; flex-direction: column; overflow: hidden;">
          
          <div id="membersListSectionPanel" style="flex: 1; overflow-y: auto; overflow-x: hidden;">
            <div class="filter-form" style="border-bottom: 1px solid #e9ecef; padding: 15px 20px;">
              <div class="form-section">
                <label for="memberFilterInputPanel">🔍 Фильтр участников (формат: <code>(поле,оператор,значение)</code>)</label>
                <select
                  id="memberFilterExamplePanel"
                  v-model="selectedMemberFilterExample"
                  @change="selectMemberFilterExamplePanel"
                  style="margin-bottom: 8px;"
                >
                  <option value="">Выберите пример</option>
                  <optgroup label="userId">
                    <option value="(userId,regex,carl)">userId содержит "carl"</option>
                    <option value="(userId,eq,alice)">userId = alice</option>
                  </optgroup>
                  <optgroup label="Активность и счётчики">
                    <option value="(isActive,eq,true)">Только активные</option>
                    <option value="(unreadCount,gt,0)">Непрочитанные &gt; 0</option>
                  </optgroup>
                  <optgroup label="Мета-теги (meta.*)">
                    <option value="(meta.role,eq,agent)">meta.role = agent</option>
                    <option value="(meta.shift,eq,day)">meta.shift = day</option>
                  </optgroup>
                  <option value="custom">Пользовательский фильтр</option>
                </select>
                <div class="input-with-clear">
                  <input
                    type="text"
                    id="memberFilterInputPanel"
                    v-model="memberFilterInput"
                    placeholder="Например: (userId,regex,carl)&(meta.role,eq,agent)"
                  />
                  <button class="clear-field" type="button" @click="clearMemberFilterFieldPanel" title="Очистить поле">✕</button>
                </div>
                <small style="display: block; margin-top: 6px; color: #6c757d;">
                  Поддерживаются поля `userId`, `isActive`, `unreadCount`, `joinedAt`, `meta.*`. Операторы: eq, ne, regex, in, nin, gt, gte, lt, lte.
                </small>
              </div>
              <div class="form-actions" style="margin-top: 8px;">
                <button class="btn-primary" type="button" @click="applyMemberFilterPanel">Применить</button>
              </div>
            </div>
            
            <!-- Пагинация участников -->
            <div id="membersPagination" class="pagination" v-show="totalMembers > 0" style="padding: 15px 20px; border-bottom: 1px solid #e9ecef;">
              <div class="pagination-info">
                Страница {{ currentMemberPage }} из {{ totalMemberPages }} (всего {{ totalMembers }} участников)
              </div>
              <div class="pagination-controls">
                <button @click="changeMemberPage(currentMemberPage - 1)" :disabled="currentMemberPage <= 1">← Предыдущая</button>
                <button
                  v-for="pageNum in visibleMemberPages"
                  :key="pageNum"
                  :class="{ active: pageNum === currentMemberPage }"
                  @click="changeMemberPage(pageNum)"
                >
                  {{ pageNum }}
                </button>
                <button @click="changeMemberPage(currentMemberPage + 1)" :disabled="currentMemberPage >= totalMemberPages">
                  Следующая →
                </button>
              </div>
            </div>
            
            <!-- Таблица участников -->
            <div id="currentMembersListPanel" style="padding: 15px 20px;">
              <div v-if="loadingMembers" class="loading">Загрузка участников...</div>
              <div v-else-if="membersError" class="error">Ошибка: {{ membersError }}</div>
              <div v-else-if="members.length === 0" class="no-data">Участников нет</div>
              <table v-else style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 2px solid #dee2e6;">
                    <th style="text-align: left; padding: 8px; color: #495057; font-weight: 600;">Пользователь</th>
                    <th style="text-align: center; padding: 8px; color: #495057; font-weight: 600;">Непрочитанные</th>
                    <th style="text-align: center; padding: 8px; color: #495057; font-weight: 600;">Активен</th>
                    <th style="text-align: left; padding: 8px; color: #495057; font-weight: 600;">Мета</th>
                    <th style="text-align: center; padding: 8px; color: #495057; font-weight: 600;">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="member in members" :key="member.userId" style="border-bottom: 1px solid #e9ecef;">
                    <td style="padding: 8px; color: #495057; font-weight: 500;">{{ member.userId }}</td>
                    <td style="padding: 8px; text-align: center; color: #6c757d;">{{ member.unreadCount || 0 }}</td>
                    <td style="padding: 8px; text-align: center;">
                      <span :style="{ color: member.isActive ? '#28a745' : '#dc3545' }">{{ member.isActive ? '✓' : '✗' }}</span>
                    </td>
                    <td style="padding: 8px; color: #6c757d; font-size: 12px;">
                      <div v-if="member.meta && Object.keys(member.meta).length > 0">
                        <div v-for="(value, key) in member.meta" :key="key">
                          <strong>{{ key }}:</strong> {{ value }}
                        </div>
                      </div>
                      <span v-else style="color: #adb5bd;">—</span>
                    </td>
                    <td style="padding: 8px; text-align: center;">
                      <button
                        v-if="currentDialogId"
                        class="btn-success btn-small"
                        @click="showMemberMetaModal(currentDialogId, member.userId)"
                        style="margin-right: 5px;"
                      >
                        🏷️ Мета
                      </button>
                      <button
                        v-if="currentDialogId"
                        class="action-button"
                        @click="removeMemberFromPanel(currentDialogId, member.userId)"
                        style="padding: 4px 12px; font-size: 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;"
                      >
                        🗑️ Удалить
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для информации -->
    <div v-if="showInfoModalFlag" class="modal" @click.self="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">{{ modalTitle }}</h2>
          <span class="close" @click="closeModal">&times;</span>
        </div>
        <div class="modal-body" v-html="modalBody"></div>
      </div>
    </div>

    <!-- Модальное окно для добавления сообщения -->
    <div v-if="showAddMessageModalFlag" class="modal" @click.self="closeAddMessageModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">Добавить сообщение{{ currentDialogId ? ` в "${currentDialogId}"` : '' }}</h2>
          <span class="close" @click="closeAddMessageModal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="modal-form-container">
            <div class="modal-form-left">
              <form @submit.prevent="submitAddMessage">
                <div class="form-group">
                  <label for="messageSender">Отправитель:</label>
                  <select id="messageSender" v-model="messageSender" required @change="updatePayloadJson">
                    <option value="carl">Carl</option>
                    <option value="marta">Marta</option>
                    <option value="sara">Sara</option>
                    <option value="kirk">Kirk</option>
                    <option value="john">John</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="messageType">Тип сообщения:</label>
                  <select id="messageType" v-model="messageType" required @change="updatePayloadJson">
                    <option value="internal.text">Text</option>
                    <option value="system.message">System</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="messageTopicId">Топик (необязательно):</label>
                  <select id="messageTopicId" v-model="messageTopicId" @change="updatePayloadJson">
                    <option value="">-- Без топика --</option>
                    <option v-for="topic in availableTopics" :key="topic.topicId" :value="topic.topicId">
                      {{ topic.topicId }}{{ topic.meta && Object.keys(topic.meta).length > 0 ? ` (${Object.entries(topic.meta).map(([k, v]) => `${k}:${v}`).join(', ')})` : '' }}
                    </option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="messageContent">Содержимое:</label>
                  <textarea id="messageContent" v-model="messageContent" rows="4" required @input="updatePayloadJson">тест тест</textarea>
                </div>
                <div class="form-group">
                  <label for="quotedMessageId">Quoted Message ID:</label>
                  <input type="text" id="quotedMessageId" v-model="quotedMessageId" placeholder="msg_..." @input="updatePayloadJson" />
                </div>
                
                <!-- Секция мета-тегов -->
                <div class="form-group">
                  <label>Мета-теги:</label>
                  <div id="metaTagsContainer">
                    <div
                      v-for="(metaTag, index) in messageMetaTags"
                      :key="index"
                      class="meta-tag-row"
                    >
                      <input
                        type="text"
                        class="meta-key"
                        v-model="metaTag.key"
                        placeholder="Ключ (например: channelType)"
                        pattern="[a-zA-Z0-9_]+"
                        title="Только латинские буквы, цифры и подчеркивание"
                        @input="updatePayloadJson"
                      />
                      <input
                        type="text"
                        class="meta-value"
                        v-model="metaTag.value"
                        placeholder="Значение (например: whatsapp)"
                        @input="updatePayloadJson"
                      />
                      <button
                        type="button"
                        class="remove-meta-btn"
                        @click="removeMetaTagRow(index)"
                        v-show="messageMetaTags.length > 1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <button type="button" @click="addMetaTagRow" class="add-meta-btn">➕ Добавить мета-тег</button>
                </div>
                
                <div class="form-actions">
                  <button type="submit" class="btn-success">Добавить</button>
                  <button type="button" class="btn-secondary" @click="closeAddMessageModal">Отмена</button>
                </div>
              </form>
            </div>
            <div class="modal-form-right">
              <!-- Отображение JSON payload -->
              <div class="payload-preview">
                <label>JSON Payload:</label>
                <div id="payloadJson" class="payload-json">{{ payloadJson }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для добавления реакции -->
    <div v-if="showReactionModalFlag" class="modal" @click.self="closeReactionModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">Добавить реакцию</h2>
          <span class="close" @click="closeReactionModal">&times;</span>
        </div>
        <div class="modal-body">
          <!-- Секция реакций -->
          <div id="existingReactionsSection" style="margin-bottom: 25px;">
            <h3 style="margin-bottom: 15px; color: #333; font-size: 16px;">Реакции:</h3>
            <div id="existingReactionsList" style="min-height: 100px; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; background: #f8f9fa;">
              <div v-if="existingReactions.length === 0" class="loading">Реакций пока нет</div>
              <div v-else style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                <button
                  v-for="reaction in existingReactions"
                  :key="reaction.reaction"
                  type="button"
                  class="reaction-item-btn"
                  :class="{ active: reaction.me }"
                  @click="toggleReaction(reaction.reaction)"
                  style="font-size: 24px; padding: 8px 16px; border: 2px solid; border-radius: 20px; cursor: pointer; transition: all 0.2s;"
                >
                  <span style="font-size: 20px;">{{ reaction.reaction }}</span>
                  <span style="margin-left: 8px; font-size: 14px; font-weight: 600;">{{ reaction.count }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Форма добавления реакции -->
          <form id="addReactionForm">
            <div class="form-group">
              <label>Добавить реакцию:</label>
              <div class="reactions-container" style="display: flex; gap: 15px; justify-content: center; padding: 20px 0; flex-wrap: wrap;">
                <button
                  type="button"
                  class="reaction-btn"
                  @click="toggleReaction('👍')"
                  style="font-size: 32px; padding: 10px 20px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s;"
                >
                  👍
                </button>
                <button
                  type="button"
                  class="reaction-btn"
                  @click="toggleReaction('❤️')"
                  style="font-size: 32px; padding: 10px 20px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s;"
                >
                  ❤️
                </button>
                <button
                  type="button"
                  class="reaction-btn"
                  @click="toggleReaction('😂')"
                  style="font-size: 32px; padding: 10px 20px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s;"
                >
                  😂
                </button>
                <button
                  type="button"
                  class="reaction-btn"
                  @click="toggleReaction('🔥')"
                  style="font-size: 32px; padding: 10px 20px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s;"
                >
                  🔥
                </button>
                <button
                  type="button"
                  class="reaction-btn"
                  @click="toggleReaction('🎉')"
                  style="font-size: 32px; padding: 10px 20px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s;"
                >
                  🎉
                </button>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" @click="closeReactionModal">Закрыть</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Модальное окно для просмотра событий сообщения -->
    <div v-if="showEventsModalFlag" class="modal" @click.self="closeEventsModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">События сообщения</h2>
          <h2 class="modal-title" id="eventUpdatesTitle" v-show="eventUpdates.length > 0" style="margin: 0; color: #495057; font-size: 18px;">Обновления события</h2>
          <span class="close" @click="closeEventsModal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="modal-form-container">
            <div class="modal-form-left">
              <div id="eventsList" style="max-height: 500px; overflow-y: auto;">
                <div v-if="loadingEvents" class="loading">Загрузка событий...</div>
                <div v-else-if="eventsError" class="error">{{ eventsError }}</div>
                <div v-else-if="events.length === 0" class="no-data">События не найдены</div>
                <table v-else style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 15%;">Время</th>
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 35%;">Описание события</th>
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 25%;">Тип события</th>
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 25%;">Обновления</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="event in events"
                      :key="event._id || event.id"
                      :data-event-id="getEventId(event)"
                      class="event-row"
                      :style="{ cursor: event.updatesCount > 0 ? 'pointer' : 'default' }"
                      @click="event.updatesCount > 0 && loadEventUpdates(getEventId(event))"
                    >
                      <td style="padding: 10px; color: #6c757d; font-size: 12px; vertical-align: top;">{{ formatEventTime(event.createdAt) }}</td>
                      <td style="padding: 10px; color: #495057; vertical-align: top;">
                        <span>{{ getEventDescription(event.eventType, event.data) }}</span>
                        <br v-if="event.actorId">
                        <span v-if="event.actorId" style="color: #6c757d; font-size: 11px;">
                          Актор: {{ event.actorId }}{{ event.actorType ? ` (${event.actorType})` : '' }}
                        </span>
                      </td>
                      <td style="padding: 10px; color: #495057; vertical-align: top;">
                        <span style="font-weight: 500; font-family: monospace; font-size: 12px;">{{ event.eventType || '-' }}</span>
                      </td>
                      <td style="padding: 10px; vertical-align: top;">
                        <button
                          v-if="event.updatesCount > 0"
                          class="action-button updates-button"
                          @click.stop="loadEventUpdates(getEventId(event))"
                          style="padding: 5px 10px; font-size: 12px;"
                        >
                          🔄 Обновления
                        </button>
                        <span v-else-if="event.updatesCount === 0" style="color: #999; font-size: 12px;">Нет обновлений</span>
                        <span v-else style="color: #999; font-size: 12px;">-</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-form-right">
              <div id="eventUpdatesList" style="max-height: 500px; overflow-y: auto;">
                <div v-if="eventUpdates.length === 0" style="padding: 20px; text-align: center; color: #6c757d;">
                  <p>Нажмите "Обновления" для просмотра обновлений</p>
                </div>
                <table v-else style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 20%;">Время</th>
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 40%;">Тип события</th>
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 40%;">Пользователь</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="update in eventUpdates" :key="update._id || update.id" style="border-bottom: 1px solid #e9ecef;">
                      <td style="padding: 10px; color: #6c757d; font-size: 12px;">{{ formatEventTime(update.createdAt) }}</td>
                      <td style="padding: 10px; color: #495057; font-size: 12px;">{{ update.eventType || '-' }}</td>
                      <td style="padding: 10px; color: #495057; font-size: 12px;">{{ update.userId || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для просмотра событий диалога -->
    <div v-if="showDialogEventsModalFlag" class="modal" @click.self="closeDialogEventsModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title modal-title-left">События диалога</h2>
          <h2 class="modal-title modal-title-right" v-show="dialogEventUpdates.length > 0" style="margin: 0; color: #495057; font-size: 18px;">Обновления диалога</h2>
          <span class="close" @click="closeDialogEventsModal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="modal-form-container">
            <div class="modal-form-left">
              <div id="dialogEventsList" style="max-height: 500px; overflow-y: auto;">
                <div v-if="loadingDialogEvents" class="loading">Загрузка событий...</div>
                <div v-else-if="dialogEventsError" class="error">{{ dialogEventsError }}</div>
                <div
                  v-else-if="dialogEvents.length === 0"
                  style="padding: 20px; text-align: center; color: #6c757d;"
                >
                  События не найдены
                </div>
                <table v-else style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 15%;">Время</th>
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 35%;">Описание события</th>
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 25%;">Тип события</th>
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 25%;">Обновления</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="event in dialogEvents"
                      :key="getDialogEventId(event) || `event-${dialogEvents.indexOf(event)}`"
                      :data-event-id="getDialogEventId(event) || ''"
                      class="event-row"
                      :class="{ 'event-row-selected': selectedDialogEventId === getDialogEventId(event) }"
                      :style="{ cursor: (event.updatesCount > 0 && getDialogEventId(event)) ? 'pointer' : 'default' }"
                      @click="(event.updatesCount > 0 && getDialogEventId(event) && currentDialogIdForEvents) && loadAllDialogUpdatesInModal(currentDialogIdForEvents, getDialogEventId(event)!)"
                    >
                      <td style="padding: 10px; color: #6c757d; font-size: 12px; vertical-align: top;">{{ formatEventTime(event.createdAt) }}</td>
                      <td style="padding: 10px; color: #495057; vertical-align: top;">
                        <span>{{ getDialogEventDescription(event.eventType, event.data) }}</span>
                        <br v-if="event.actorId">
                        <span v-if="event.actorId" style="color: #6c757d; font-size: 11px;">
                          Актор: {{ event.actorId }}{{ event.actorType ? ` (${event.actorType})` : '' }}
                        </span>
                      </td>
                      <td style="padding: 10px; color: #495057; vertical-align: top;">
                        <span style="font-weight: 500; font-family: monospace; font-size: 12px;">{{ event.eventType || '-' }}</span>
                      </td>
                      <td style="padding: 10px; vertical-align: top;">
                        <button
                          v-if="event.updatesCount > 0 && getDialogEventId(event) && currentDialogIdForEvents"
                          class="action-button updates-button"
                          @click.stop="loadAllDialogUpdatesInModal(currentDialogIdForEvents, getDialogEventId(event)!)"
                          style="padding: 5px 10px; font-size: 12px;"
                        >
                          🔄 Обновления
                        </button>
                        <span v-else-if="event.updatesCount === 0" style="color: #999; font-size: 12px;">Нет обновлений</span>
                        <span v-else style="color: #999; font-size: 12px;">-</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-form-right">
              <div id="dialogEventUpdatesList" style="max-height: 500px; overflow-y: auto;">
                <div v-if="dialogEventUpdates.length === 0" style="padding: 20px; text-align: center; color: #6c757d;">
                  <p>Нажмите "Обновления" для просмотра обновлений</p>
                </div>
                <table v-else style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 20%;">Время</th>
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 40%;">Тип события</th>
                      <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057; width: 40%;">Пользователь</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="update in dialogEventUpdates" :key="getUpdateId(update)" style="border-bottom: 1px solid #e9ecef;">
                      <td style="padding: 10px; color: #6c757d; font-size: 12px;">{{ formatEventTime(update.createdAt) }}</td>
                      <td style="padding: 10px; color: #495057; font-size: 12px;">{{ update.eventType || '-' }}</td>
                      <td style="padding: 10px; color: #495057; font-size: 12px;">{{ update.userId || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для просмотра матрицы статусов сообщения -->
    <div v-if="showStatusMatrixModalFlag" class="modal" @click.self="closeStatusMatrixModal">
      <div class="modal-content" style="max-width: 700px;" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">📊 Матрица статусов сообщения</h2>
          <span class="close" @click="closeStatusMatrixModal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="info-url" id="statusMatrixUrl" style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;"></div>
          <div id="statusMatrixContent">
            <div v-if="loadingStatusMatrix" class="loading">Загрузка матрицы статусов...</div>
            <div v-else-if="statusMatrixError" class="error">{{ statusMatrixError }}</div>
            <div v-else-if="statusMatrix.length === 0" class="no-data">Нет данных о статусах для этого сообщения</div>
            <table v-else style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                  <th style="text-align: left; padding: 12px; font-weight: 600; color: #495057;">Тип пользователя</th>
                  <th style="text-align: left; padding: 12px; font-weight: 600; color: #495057;">Статус</th>
                  <th style="text-align: right; padding: 12px; font-weight: 600; color: #495057;">Количество</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in statusMatrix" :key="`${item.userType}-${item.status}`" style="border-bottom: 1px solid #e9ecef;">
                  <td style="padding: 12px; color: #495057; vertical-align: middle;">
                    <span style="font-weight: 500;">{{ item.userType || 'не указан' }}</span>
                  </td>
                  <td style="padding: 12px; color: #495057; vertical-align: middle;">
                    <span style="font-family: monospace; font-size: 13px;">{{ item.status || '-' }}</span>
                  </td>
                  <td style="padding: 12px; text-align: right; color: #495057; vertical-align: middle; font-weight: 600;">
                    {{ item.count || 0 }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для просмотра статусов сообщения -->
    <div v-if="showStatusesModalFlag" class="modal" @click.self="closeStatusesModal">
      <div class="modal-content" style="max-width: 900px;" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">📋 Статусы сообщения</h2>
          <span class="close" @click="closeStatusesModal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="info-url" id="statusesUrl" style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;"></div>
          <div id="statusesContent">
            <div v-if="loadingStatuses" class="loading">Загрузка статусов...</div>
            <div v-else-if="statusesError" class="error">{{ statusesError }}</div>
            <div v-else-if="statuses.length === 0" class="no-data">Нет статусов для этого сообщения</div>
            <table v-else style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
              <thead>
                <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                  <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">userId</th>
                  <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">userType</th>
                  <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">status</th>
                  <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">createdAt</th>
                  <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">updatedAt</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="status in statuses" :key="`${status.userId}-${status.status}`" style="border-bottom: 1px solid #e9ecef;">
                  <td style="padding: 10px; color: #495057; vertical-align: middle;">
                    <span style="font-family: monospace; font-size: 12px;">{{ status.userId || '-' }}</span>
                  </td>
                  <td style="padding: 10px; color: #495057; vertical-align: middle;">{{ status.userType || '-' }}</td>
                  <td style="padding: 10px; color: #495057; vertical-align: middle;">
                    <span style="font-family: monospace; font-size: 12px;">{{ status.status || '-' }}</span>
                  </td>
                  <td style="padding: 10px; color: #495057; vertical-align: middle; font-size: 12px;">
                    {{ formatEventTime(status.createdAt) }}
                  </td>
                  <td style="padding: 10px; color: #495057; vertical-align: middle; font-size: 12px;">
                    {{ formatEventTime(status.updatedAt) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div id="statusesPagination" v-show="totalStatusesPages > 1" style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8f9fa; border-radius: 4px;">
            <div style="font-size: 12px; color: #6c757d;">
              Всего: {{ totalStatuses }} | Страница {{ currentStatusesPage }} из {{ totalStatusesPages }}
            </div>
            <div style="display: flex; gap: 5px;">
              <button
                v-if="currentStatusesPage > 1"
                @click="goToStatusesPage(currentStatusesPage - 1)"
                style="padding: 5px 10px; font-size: 12px; border: 1px solid #dee2e6; background: white; border-radius: 4px; cursor: pointer;"
              >
                ◀
              </button>
              <button
                v-if="currentStatusesPage < totalStatusesPages"
                @click="goToStatusesPage(currentStatusesPage + 1)"
                style="padding: 5px 10px; font-size: 12px; border: 1px solid #dee2e6; background: white; border-radius: 4px; cursor: pointer;"
              >
                ▶
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно мета-тегов диалога -->
    <div v-if="showDialogMetaModalFlag" class="modal" @click.self="closeDialogMetaModal">
      <div class="modal-content width-60" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">🏷️ Meta теги диалога</h2>
          <span class="close" @click="closeDialogMetaModal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="meta-list">
            <div v-if="loadingDialogMeta" class="loading">Загрузка meta тегов...</div>
            <template v-else>
              <h3 style="margin-bottom: 15px; font-size: 14px;">Текущие Meta теги:</h3>
              <div v-if="Object.keys(dialogMetaTags).length === 0" class="no-data">
                Meta теги отсутствуют
              </div>
              <table v-else style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">Key</th>
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">Value</th>
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(value, key) in dialogMetaTags"
                    :key="key"
                    style="border-bottom: 1px solid #e9ecef;"
                  >
                    <td style="padding: 10px;">
                      <strong>{{ key }}</strong>
                    </td>
                    <td style="padding: 10px;">
                      {{ JSON.stringify(value) }}
                    </td>
                    <td style="padding: 10px;">
                      <button
                        type="button"
                        class="btn-danger btn-small"
                        @click="deleteDialogMetaTag(key)"
                      >
                        🗑️ Удалить
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </div>

          <div class="meta-section">
            <h3>Добавить Meta тег</h3>
            <div class="meta-tag-row">
              <input
                type="text"
                v-model="newDialogMetaKey"
                placeholder="key (например: type)"
              />
              <input
                type="text"
                v-model="newDialogMetaValue"
                placeholder='value (например: "internal" или {"foo": "bar"})'
              />
              <button
                type="button"
                class="btn-success btn-add-meta-tag"
                @click="addDialogMetaTag"
              >
                ➕ Добавить
              </button>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="closeDialogMetaModal">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для установки статуса сообщения -->
    <div v-if="showSetStatusModalFlag" class="modal" @click.self="closeSetStatusModal">
      <div class="modal-content" style="max-width: 500px;" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">✏️ Установить статус сообщения</h2>
          <span class="close" @click="closeSetStatusModal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="info-url" id="setStatusUrl" style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;"></div>
          <div style="margin-bottom: 20px;">
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">Выберите статус для текущего пользователя:</p>
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
              <button
                type="button"
                class="status-action-btn"
                @click="setMessageStatus('unread')"
                style="background: #6c757d; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; transition: all 0.2s;"
              >
                📤 Sent (unread)
              </button>
              <button
                type="button"
                class="status-action-btn"
                @click="setMessageStatus('delivered')"
                style="background: #17a2b8; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; transition: all 0.2s;"
              >
                📥 Received (delivered)
              </button>
              <button
                type="button"
                class="status-action-btn"
                @click="setMessageStatus('read')"
                style="background: #28a745; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; transition: all 0.2s;"
              >
                ✓ Read
              </button>
            </div>
          </div>
          <div id="setStatusResult" style="margin-top: 20px; padding: 10px; border-radius: 4px; display: none;"></div>
        </div>
      </div>
    </div>

    <!-- Модальное окно мета-тегов сообщения -->
    <div v-if="showMessageMetaModalFlag" class="modal" @click.self="closeMessageMetaModal">
      <div class="modal-content width-60" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">🏷️ Meta теги сообщения</h2>
          <span class="close" @click="closeMessageMetaModal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="meta-list">
            <div v-if="loadingMessageMeta" class="loading">Загрузка meta тегов...</div>
            <template v-else>
              <h3 style="margin-bottom: 15px; font-size: 14px;">Текущие Meta теги:</h3>
              <div v-if="Object.keys(messageMetaTagsData).length === 0" class="no-data">
                Meta теги отсутствуют
              </div>
              <table v-else style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">Key</th>
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">Value</th>
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(value, key) in messageMetaTagsData"
                    :key="key"
                    style="border-bottom: 1px solid #e9ecef;"
                  >
                    <td style="padding: 10px;">
                      <strong>{{ key }}</strong>
                    </td>
                    <td style="padding: 10px;">
                      {{ JSON.stringify(value) }}
                    </td>
                    <td style="padding: 10px;">
                      <button
                        type="button"
                        class="btn-danger btn-small"
                        @click="deleteMessageMetaTag(key)"
                      >
                        🗑️ Удалить
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </div>

          <div class="meta-section">
            <h3>Добавить Meta тег</h3>
            <div class="meta-tag-row">
              <input
                type="text"
                v-model="newMessageMetaKey"
                placeholder="key (например: channelType)"
              />
              <input
                type="text"
                v-model="newMessageMetaValue"
                placeholder='value (например: "whatsapp" или {"foo": "bar"})'
              />
              <button
                type="button"
                class="btn-success btn-add-meta-tag"
                @click="addMessageMetaTag"
              >
                ➕ Добавить
              </button>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="closeMessageMetaModal">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для добавления участника -->
    <div v-if="showAddMemberModalFlag" class="modal" @click.self="closeAddMemberModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">Добавить участника</h2>
          <span class="close" @click="closeAddMemberModal">&times;</span>
        </div>
        <div class="modal-body">
          <form @submit.prevent="submitAddMember">
            <div class="form-group">
              <label for="newMemberSelectModal">Выберите пользователя:</label>
              <select
                id="newMemberSelectModal"
                v-model="newMemberSelect"
                required
                style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;"
              >
                <option value="">-- Выберите пользователя --</option>
                <option v-for="user in availableUsersForMember" :key="user.userId" :value="user.userId">
                  {{ user.userId }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label for="newMemberTypeModal">Тип участника (опционально):</label>
              <select
                id="newMemberTypeModal"
                v-model="newMemberType"
                style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;"
              >
                <option value="">-- Выберите тип --</option>
                <option value="user">user</option>
                <option value="bot">bot</option>
                <option value="contact">contact</option>
                <option value="admin">admin</option>
                <option value="moderator">moderator</option>
              </select>
            </div>
            <div class="form-group">
              <label>Мета-теги (опционально):</label>
              <div style="margin-top: 10px;">
                <div
                  v-for="(metaTag, index) in newMemberMetaTags"
                  :key="index"
                  class="meta-tag-row"
                  style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;"
                >
                  <input
                    type="text"
                    v-model="metaTag.key"
                    placeholder="Ключ"
                    style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                  />
                  <input
                    type="text"
                    v-model="metaTag.value"
                    placeholder="Значение"
                    style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                  />
                  <button
                    type="button"
                    class="remove-meta-btn"
                    @click="removeMemberMetaRow(index)"
                    v-show="newMemberMetaTags.length > 1"
                    style="padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <button
                type="button"
                class="btn-add-tag"
                @click="addMemberMetaRow"
                style="margin-top: 10px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;"
              >
                ➕ Добавить мета-тег
              </button>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-success">Добавить</button>
              <button type="button" class="btn-secondary" @click="closeAddMemberModal">Отмена</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Модальное окно для редактирования мета-тегов участника -->
    <div v-if="showMemberMetaModalFlag" class="modal" @click.self="closeMemberMetaModal">
      <div class="modal-content width-60" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">Мета-теги участника: {{ memberMetaModalUserId }}</h2>
          <span class="close" @click="closeMemberMetaModal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="form-section">
            <label>Участник:</label>
            <div style="padding: 10px; background: #f8f9fa; border-radius: 4px; margin-bottom: 15px;">
              Диалог: {{ memberMetaModalDialogId }}<br />
              Участник: {{ memberMetaModalUserId }}
            </div>
          </div>
          <div class="member-meta-editor">
            <div v-if="memberMetaTags.length === 0" class="member-meta-empty">Мета-теги отсутствуют</div>
            <div v-else>
              <div v-for="(metaTag, index) in memberMetaTags" :key="index" class="member-meta-row">
                <input
                  type="text"
                  v-model="metaTag.key"
                  placeholder="Ключ"
                  :readonly="metaTag.isExisting"
                  class="member-meta-key"
                />
                <input
                  type="text"
                  v-model="metaTag.value"
                  placeholder="Значение"
                  class="member-meta-value"
                />
                <button
                  type="button"
                  class="remove-meta-btn"
                  @click="removeMemberMetaRowModal(index)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
          <div class="meta-editor-actions" style="margin-top: 15px;">
            <button type="button" class="btn-add-tag" @click="addMemberMetaRowModal">➕ Добавить тег</button>
          </div>
          <div class="form-actions" style="margin-top: 20px;">
            <button type="button" class="btn-primary" @click="saveMemberMetaChangesModal">Сохранить</button>
            <button type="button" class="btn-secondary" @click="closeMemberMetaModal">Отмена</button>
          </div>
          <div v-if="memberMetaStatus" class="status-message" style="margin-top: 15px; padding: 10px; border-radius: 4px; background: #d4edda; color: #155724; border: 1px solid #c3e6cb;">
            {{ memberMetaStatus }}
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для создания топика -->
    <div v-if="showAddTopicModalFlag" class="modal" @click.self="closeAddTopicModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">Создать топик</h2>
          <span class="close" @click="closeAddTopicModal">&times;</span>
        </div>
        <div class="modal-body">
          <form @submit.prevent="submitAddTopic">
            <div class="form-group">
              <label>Мета-теги (опционально):</label>
              <div style="margin-top: 10px;">
                <div
                  v-for="(metaTag, index) in newTopicMetaTags"
                  :key="index"
                  class="meta-tag-row"
                  style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;"
                >
                  <input
                    type="text"
                    v-model="metaTag.key"
                    placeholder="Ключ"
                    style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                  />
                  <input
                    type="text"
                    v-model="metaTag.value"
                    placeholder="Значение"
                    style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                  />
                  <button
                    type="button"
                    class="remove-meta-btn"
                    @click="removeTopicMetaRow(index)"
                    v-show="newTopicMetaTags.length > 1"
                    style="padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <button
                type="button"
                class="btn-add-tag"
                @click="addTopicMetaRow"
                style="margin-top: 10px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;"
              >
                ➕ Добавить мета-тег
              </button>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-success">Создать</button>
              <button type="button" class="btn-secondary" @click="closeAddTopicModal">Отмена</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Модальное окно для мета-тегов топика -->
    <div v-if="showTopicMetaModalFlag" class="modal" @click.self="closeTopicMetaModal">
      <div class="modal-content width-60" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">🏷️ Meta теги топика</h2>
          <span class="close" @click="closeTopicMetaModal">&times;</span>
        </div>
        <div class="modal-body">
          <div class="meta-list">
            <div v-if="loadingTopicMeta" class="loading">Загрузка meta тегов...</div>
            <template v-else>
              <h3 style="margin-bottom: 15px; font-size: 14px;">Текущие Meta теги:</h3>
              <div v-if="Object.keys(topicMetaTags).length === 0" class="no-data">
                Meta теги отсутствуют
              </div>
              <table v-else style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">Key</th>
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">Value</th>
                    <th style="text-align: left; padding: 10px; font-weight: 600; color: #495057;">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(value, key) in topicMetaTags"
                    :key="key"
                    style="border-bottom: 1px solid #e9ecef;"
                  >
                    <td style="padding: 10px;">
                      <strong>{{ key }}</strong>
                    </td>
                    <td style="padding: 10px;">
                      {{ JSON.stringify(value) }}
                    </td>
                    <td style="padding: 10px;">
                      <button
                        type="button"
                        class="btn-danger btn-small"
                        @click="deleteTopicMetaTag(key)"
                      >
                        🗑️ Удалить
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </div>

          <div class="meta-section">
            <h3>Добавить Meta тег</h3>
            <div class="meta-tag-row">
              <input
                type="text"
                v-model="newTopicMetaKey"
                placeholder="key (например: category)"
              />
              <input
                type="text"
                v-model="newTopicMetaValue"
                placeholder='value (например: "general" или {"foo": "bar"})'
              />
              <button
                type="button"
                class="btn-success btn-add-meta-tag"
                @click="addTopicMetaTag"
              >
                ➕ Добавить
              </button>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="closeTopicMetaModal">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, toRef, nextTick } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';

// Конфигурация
const configStore = useConfigStore();
const credentialsStore = useCredentialsStore();

// Используем credentials из store
const apiKey = toRef(credentialsStore, 'apiKey');
const tenantId = toRef(credentialsStore, 'tenantId');

// Состояние пользователей
const loadingUsers = ref(false);
const usersError = ref<string | null>(null);
const users = ref<any[]>([]);
const currentUserId = ref<string | null>(null);
const currentUserName = ref<string>('');
const currentUserPage = ref(1);
const currentUserLimit = ref(100);
const totalUserPages = ref(1);
const totalUsers = ref(0);
const currentUserPageInput = ref(1);
const userFilterInput = ref('');
const selectedUserFilterExample = ref('');
const currentUserFilter = ref('');

// Состояние диалогов
const loadingDialogs = ref(false);
const dialogsError = ref<string | null>(null);
const dialogs = ref<any[]>([]);
const currentDialogId = ref<string | null>(null);
const currentDialogPage = ref(1);
const totalDialogPages = ref(1);
const totalDialogs = ref(0);
const filterValue = ref('');
const selectedFilterExample = ref('');
const currentDialogFilter = ref('');

// Состояние сообщений
const loadingMessages = ref(false);
const messagesError = ref<string | null>(null);
const messages = ref<any[]>([]);
const currentMessagePage = ref(1);
const totalMessagePages = ref(1);
const totalMessages = ref(0);
const messageFilterInput = ref('');
const selectedMessageFilterExample = ref('');
const currentMessageFilter = ref('');
const currentViewMode = ref<'messages' | 'members' | 'topics'>('messages');

// Состояние участников
const loadingMembers = ref(false);
const membersError = ref<string | null>(null);
const members = ref<any[]>([]);
const currentMemberPage = ref(1);
const totalMemberPages = ref(1);
const totalMembers = ref(0);
const memberFilterInput = ref('');
const selectedMemberFilterExample = ref('');
const currentMemberFilter = ref('');
const currentDialogIdForMembers = ref<string | null>(null);

// Состояние топиков
const loadingTopics = ref(false);
const topicsError = ref<string | null>(null);
const topics = ref<any[]>([]);
const currentTopicsPage = ref(1);
const totalTopicsPages = ref(1);

// Модальные окна
const showInfoModalFlag = ref(false);
const showAddMessageModalFlag = ref(false);
const showReactionModalFlag = ref(false);
const showEventsModalFlag = ref(false);
const showUpdatesModalFlag = ref(false);
const showStatusMatrixModalFlag = ref(false);
const showStatusesModalFlag = ref(false);
const showSetStatusModalFlag = ref(false);
const showDialogEventsModalFlag = ref(false);
const showDialogUpdatesModalFlag = ref(false);
const showDialogMetaModalFlag = ref(false);
const showAddMemberModalFlag = ref(false);
const showAddTopicModalFlag = ref(false);
const showMemberMetaModalFlag = ref(false);
const showMessageMetaModalFlag = ref(false);
const showTopicMetaModalFlag = ref(false);
const showUsersUrlModalFlag = ref(false);
const showCurrentUrlModalFlag = ref(false);
const showCurrentMessageUrlModalFlag = ref(false);
const showMembersUrlModalFlag = ref(false);
const showTopicsUrlModalFlag = ref(false);

// Модальные окна - данные
const modalTitle = ref('Информация');
const modalBody = ref('');
const modalUrl = ref('');
const currentModalJsonForCopy = ref<string | null>(null);

// Добавление сообщения
const messageSender = ref('carl');
const messageType = ref('internal.text');
const messageContent = ref('тест тест');
const messageTopicId = ref('');
const quotedMessageId = ref('');
const messageMetaTags = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);
const availableTopics = ref<any[]>([]);
const payloadJson = ref('{}');

// Реакции
const currentMessageIdForReaction = ref<string | null>(null);
const existingReactions = ref<any[]>([]);
const selectedReaction = ref<string | null>(null);

// События
const currentMessageIdForEvents = ref<string | null>(null);
const events = ref<any[]>([]);
const loadingEvents = ref(false);
const eventsError = ref<string | null>(null);
const selectedEventId = ref<string | null>(null);
const eventUpdates = ref<any[]>([]);

// Статусы - дополнительные состояния
const loadingStatusMatrix = ref(false);
const statusMatrixError = ref<string | null>(null);
const loadingStatuses = ref(false);
const statusesError = ref<string | null>(null);
const totalStatuses = ref(0);
const currentMessageIdForSetStatus = ref<string | null>(null);
const setStatusResult = ref('');

// Статусы
const currentMessageIdForStatuses = ref<string | null>(null);
const statusMatrix = ref<any[]>([]);
const statuses = ref<any[]>([]);
const currentStatusesPage = ref(1);
const currentStatusesLimit = ref(50);
const totalStatusesPages = ref(1);

// Мета-теги диалога
const dialogMetaDialogId = ref('');
const dialogMetaTags = ref<Record<string, any>>({});
const loadingDialogMeta = ref(false);
const newDialogMetaKey = ref('');
const newDialogMetaValue = ref('');

// Добавление участника
const newMemberSelect = ref('');
const newMemberType = ref('');
const newMemberMetaTags = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);
const availableUsersForMember = ref<any[]>([]);

// События диалога
const currentDialogIdForEvents = ref<string | null>(null);
const dialogEvents = ref<any[]>([]);
const loadingDialogEvents = ref(false);
const dialogEventsError = ref<string | null>(null);
const dialogEventUpdates = ref<any[]>([]);
const selectedDialogEventId = ref<string | null>(null);

// Мета-теги - дополнительные состояния
const loadingMessageMeta = ref(false);
const loadingTopicMeta = ref(false);

// Топики - мета-теги для создания
const newTopicMetaTags = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);

// Мета-теги участника
const memberMetaModalDialogId = ref('');
const memberMetaModalUserId = ref('');
const memberMetaTags = ref<Array<{ key: string; value: string; isExisting: boolean }>>([]);
const currentMemberMetaOriginal = ref<Record<string, any>>({});
const memberMetaStatus = ref('');

// Мета-теги сообщения (для модального окна просмотра/редактирования)
const messageMetaMessageId = ref('');
const messageMetaTagsData = ref<Record<string, any>>({});
const newMessageMetaKey = ref('');
const newMessageMetaValue = ref('');

// Мета-теги топика
const topicMetaDialogId = ref('');
const topicMetaTopicId = ref('');
const topicMetaTags = ref<Record<string, any>>({});
const newTopicMetaKey = ref('');
const newTopicMetaValue = ref('');

// URL модальные окна
const generatedUrl = ref('');
const copyUrlButtonText = ref('📋 Скопировать');

// Computed
const userPaginationStart = computed(() => {
  return (currentUserPage.value - 1) * currentUserLimit.value + 1;
});

const userPaginationEnd = computed(() => {
  return Math.min(currentUserPage.value * currentUserLimit.value, totalUsers.value);
});

const showDialogsPagination = computed(() => {
  return totalDialogs.value > 0 && currentUserId.value !== null;
});

const showMessagesPagination = computed(() => {
  return totalMessages.value > 0 && currentDialogId.value !== null;
});

const visibleDialogPages = computed(() => {
  const pages: number[] = [];
  const total = totalDialogPages.value;
  const current = currentDialogPage.value;
  const maxVisible = 10;

  let start = Math.max(1, current - Math.floor(maxVisible / 2));
  let end = Math.min(total, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});

const visibleMessagePages = computed(() => {
  const pages: number[] = [];
  const total = totalMessagePages.value;
  const current = currentMessagePage.value;
  const maxVisible = 10;

  let start = Math.max(1, current - Math.floor(maxVisible / 2));
  let end = Math.min(total, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});

const visibleMemberPages = computed(() => {
  const pages: number[] = [];
  const total = totalMemberPages.value;
  const current = currentMemberPage.value;
  const maxVisible = 10;

  let start = Math.max(1, current - Math.floor(maxVisible / 2));
  let end = Math.min(total, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});

// Функции для пользователей
async function loadUsers(page = currentUserPage.value, limit = currentUserLimit.value) {
  try {
    const key = apiKey.value;
    if (!key) {
      throw new Error('API Key не указан');
    }

    currentUserPage.value = page;
    currentUserLimit.value = limit;
    loadingUsers.value = true;
    usersError.value = null;

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (currentUserFilter.value) {
      params.append('filter', currentUserFilter.value);
    }

    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/users?${params.toString()}`, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    totalUsers.value = data.pagination?.total || 0;
    totalUserPages.value = data.pagination?.pages || 1;

    if (data.data && data.data.length > 0) {
      const usersData = data.data.map((user: any) => ({
        ...user,
        displayName: user.displayName || user.userId,
        dialogCount: Number.isFinite(user.dialogCount) ? user.dialogCount : 0
      }));
      
      users.value = usersData.sort((a: any, b: any) => {
        // Сначала по dialogCount (по убыванию)
        if (b.dialogCount !== a.dialogCount) {
          return b.dialogCount - a.dialogCount;
        }
        // Затем по displayName (по алфавиту)
        const nameA = (a.displayName || '').toLowerCase();
        const nameB = (b.displayName || '').toLowerCase();
        if (nameA === nameB) {
          // Если displayName одинаковые, то по userId
          return a.userId.localeCompare(b.userId);
        }
        return nameA.localeCompare(nameB);
      });
    } else {
      users.value = [];
    }
  } catch (err) {
    console.error('Error loading users:', err);
    usersError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
    users.value = [];
  } finally {
    loadingUsers.value = false;
  }
}

function selectUserFilterExample() {
  if (selectedUserFilterExample.value && selectedUserFilterExample.value !== 'custom') {
    userFilterInput.value = selectedUserFilterExample.value;
  } else if (selectedUserFilterExample.value === 'custom') {
    userFilterInput.value = '';
  }
}

function clearUserFilter() {
  userFilterInput.value = '';
  selectedUserFilterExample.value = '';
  currentUserFilter.value = '';
  loadUsers(1, currentUserLimit.value);
}

function applyUserFilter() {
  currentUserFilter.value = userFilterInput.value.trim();
  loadUsers(1, currentUserLimit.value);
}

function goToUsersFirstPage() {
  if (currentUserPage.value > 1) {
    loadUsers(1, currentUserLimit.value);
  }
}

function goToUsersPreviousPage() {
  if (currentUserPage.value > 1) {
    loadUsers(currentUserPage.value - 1, currentUserLimit.value);
  }
}

function goToUsersNextPage() {
  if (currentUserPage.value < totalUserPages.value) {
    loadUsers(currentUserPage.value + 1, currentUserLimit.value);
  }
}

function goToUsersLastPage() {
  if (currentUserPage.value < totalUserPages.value) {
    loadUsers(totalUserPages.value, currentUserLimit.value);
  }
}

function goToUsersPage(page: number) {
  if (page >= 1 && page <= totalUserPages.value) {
    loadUsers(page, currentUserLimit.value);
  }
}

function changeUserLimit(limit: number) {
  loadUsers(1, limit);
}

async function selectUser(userId: string, userName: string) {
  currentUserId.value = userId;
  currentUserName.value = userName;
  currentDialogId.value = null;
  dialogs.value = [];
  messages.value = [];
  await loadUserDialogs(userId, 1);
}

// Функции для диалогов
async function loadUserDialogs(userId: string, page = 1) {
  try {
    if (!userId) {
      return;
    }

    loadingDialogs.value = true;
    dialogsError.value = null;

    let url = `/api/users/${userId}/dialogs?page=${page}&limit=10`;

    if (currentDialogFilter.value) {
      url += `&filter=${encodeURIComponent(currentDialogFilter.value)}`;
    }

    console.log('Loading user dialogs:', url);
    console.log('Headers:', credentialsStore.getHeaders());

    const response = await fetch(url, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      } else {
        const errorText = await response.text();
        throw new Error(`Сервер вернул не JSON. Status: ${response.status}. Ответ: ${errorText.substring(0, 200)}`);
      }
    }

    // Проверяем Content-Type перед парсингом
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Сервер вернул не JSON. Status: ${response.status}. Content-Type: ${contentType}. Ответ: ${text.substring(0, 200)}`);
    }

    const data = await response.json();
    totalDialogs.value = data.pagination?.total || 0;
    totalDialogPages.value = data.pagination?.pages || 1;
    currentDialogPage.value = page;

    if (data.data && data.data.length > 0) {
      dialogs.value = data.data;
    } else {
      dialogs.value = [];
    }
  } catch (err) {
    console.error('Error loading dialogs:', err);
    dialogsError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
    dialogs.value = [];
  } finally {
    loadingDialogs.value = false;
  }
}

function selectFilterExample() {
  if (selectedFilterExample.value && selectedFilterExample.value !== 'custom') {
    filterValue.value = selectedFilterExample.value;
  } else if (selectedFilterExample.value === 'custom') {
    filterValue.value = '';
  }
}

function clearFilter() {
  filterValue.value = '';
  selectedFilterExample.value = '';
  currentDialogFilter.value = '';
  if (currentUserId.value) {
    loadUserDialogs(currentUserId.value, 1);
  }
}

function applyFilter() {
  currentDialogFilter.value = filterValue.value.trim();
  if (currentUserId.value) {
    loadUserDialogs(currentUserId.value, 1);
  }
}

function changeDialogPage(page: number) {
  if (currentUserId.value) {
    loadUserDialogs(currentUserId.value, page);
  }
}

function selectDialog(dialogId: string) {
  currentDialogId.value = dialogId;
  currentViewMode.value = 'messages';
  loadDialogMessages(dialogId, 1);
}

async function selectDialogMembers(dialogId: string) {
  currentDialogId.value = dialogId;
  currentDialogIdForMembers.value = dialogId;
  currentViewMode.value = 'members';
  currentMemberFilter.value = '';
  currentMemberPage.value = 1;
  await loadDialogMembers(dialogId, 1);
}

async function selectDialogTopics(dialogId: string) {
  currentDialogId.value = dialogId;
  currentViewMode.value = 'topics';
  await loadDialogTopics(dialogId, 1);
}

// Функции для сообщений
async function loadDialogMessages(dialogId: string, page = 1) {
  try {
    if (!dialogId || !currentUserId.value) {
      return;
    }

    loadingMessages.value = true;
    messagesError.value = null;

    // Используем endpoint с контекстом пользователя
    let url = `/api/users/${currentUserId.value}/dialogs/${dialogId}/messages?page=${page}&limit=10`;

    if (currentMessageFilter.value) {
      url += `&filter=${encodeURIComponent(currentMessageFilter.value)}`;
    }

    const response = await fetch(url, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    totalMessages.value = data.pagination?.total || 0;
    totalMessagePages.value = data.pagination?.pages || 1;
    currentMessagePage.value = page;

    if (data.data && data.data.length > 0) {
      messages.value = data.data;
    } else {
      messages.value = [];
    }
  } catch (err) {
    console.error('Error loading messages:', err);
    messagesError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
    messages.value = [];
  } finally {
    loadingMessages.value = false;
  }
}

function selectMessageFilterExample() {
  if (selectedMessageFilterExample.value && selectedMessageFilterExample.value !== 'custom') {
    messageFilterInput.value = selectedMessageFilterExample.value;
  } else if (selectedMessageFilterExample.value === 'custom') {
    messageFilterInput.value = '';
  }
}

function clearMessageFilter() {
  messageFilterInput.value = '';
  selectedMessageFilterExample.value = '';
  currentMessageFilter.value = '';
  if (currentDialogId.value) {
    loadDialogMessages(currentDialogId.value, 1);
  }
}

function applyMessageFilter() {
  currentMessageFilter.value = messageFilterInput.value.trim();
  if (currentDialogId.value) {
    loadDialogMessages(currentDialogId.value, 1);
  }
}

function changeMessagePage(page: number) {
  if (currentDialogId.value) {
    loadDialogMessages(currentDialogId.value, page);
  }
}

// Утилиты
function formatLastSeen(timestamp: string | number | null | undefined) {
  if (!timestamp) return '-';
  const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
  const date = new Date(ts);
  return date.toLocaleString('ru-RU');
}

function formatMessageTime(timestamp: string | number) {
  if (!timestamp) return '';
  const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
  const date = new Date(ts);
  return date.toLocaleString('ru-RU');
}

function shortenDialogId(dialogId: string) {
  if (!dialogId) return '-';
  if (dialogId.startsWith('dlg_')) {
    return `dlg_${dialogId.substring(4, 8)}...`;
  }
  return dialogId.length > 20 ? dialogId.substring(0, 20) + '...' : dialogId;
}

function shortenTopicId(topicId: string) {
  if (!topicId) return '-';
  if (topicId.startsWith('topic_')) {
    return `topic_${topicId.substring(6, 10)}...`;
  }
  return topicId;
}

function escapeHtml(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMessageStatus(message: any): string | null {
  if (!message.context?.isMine) return null;
  const statusMatrix = message.statusMessageMatrix || [];
  const readStatus = statusMatrix.find(
    (item: any) => item.userType === 'user' && item.status === 'read' && item.count >= 1
  );
  return readStatus ? 'read' : 'sent';
}

function getStatusIcon(status: string | null): string {
  if (!status) return '?';
  const icons: Record<string, string> = {
    sent: '✓',
    delivered: '✓✓',
    read: '✓✓',
    unread: '◯',
  };
  return icons[status] || '?';
}

function getStatusColor(status: string | null): string {
  if (!status) return '#999';
  const colors: Record<string, string> = {
    sent: '#999',
    delivered: '#999',
    read: '#4fc3f7',
    unread: '#ccc',
  };
  return colors[status] || '#999';
}

// Функции для участников
async function loadDialogMembers(dialogId: string, page = 1) {
  try {
    if (!dialogId) {
      return;
    }

    loadingMembers.value = true;
    membersError.value = null;

    const params = new URLSearchParams({
      page: page.toString(),
      limit: '10',
      sort: '(joinedAt,asc)',
    });

    if (currentMemberFilter.value) {
      params.append('filter', currentMemberFilter.value);
    }

    const response = await fetch(`/api/dialogs/${dialogId}/members?${params.toString()}`, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    totalMembers.value = data.pagination?.total || 0;
    totalMemberPages.value = data.pagination?.pages || 1;
    currentMemberPage.value = page;

    if (data.data && data.data.length > 0) {
      members.value = data.data;
    } else {
      members.value = [];
    }
  } catch (err) {
    console.error('Error loading members:', err);
    membersError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
    members.value = [];
  } finally {
    loadingMembers.value = false;
  }
}

// Функции для топиков
async function loadDialogTopics(dialogId: string, page = 1) {
  try {
    if (!dialogId || !currentUserId.value) {
      return;
    }

    loadingTopics.value = true;
    topicsError.value = null;

    const url = `/api/users/${currentUserId.value}/dialogs/${dialogId}/topics?page=${page}&limit=20`;

    const response = await fetch(url, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    totalTopicsPages.value = data.pagination?.pages || 1;
    currentTopicsPage.value = page;

    if (data.data && data.data.length > 0) {
      topics.value = data.data;
    } else {
      topics.value = [];
    }
  } catch (err) {
    console.error('Error loading topics:', err);
    topicsError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
    topics.value = [];
  } finally {
    loadingTopics.value = false;
  }
}

// Модальные окна - базовые функции
function showModal(title: string, content: string, url: string | null = null, jsonContent: any = null) {
  modalTitle.value = title;

  let modalContent = '';

  if (url) {
    modalContent += `<div class="info-url" style="margin-bottom: 15px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;">${escapeHtml(url)}</div>`;
  }

  modalContent += content;

  if (jsonContent) {
    const jsonStr = JSON.stringify(jsonContent, null, 2);
    currentModalJsonForCopy.value = jsonStr;
    modalContent += `<div class="form-actions" style="margin-top: 15px; justify-content: flex-end;">
      <button type="button" class="btn-primary" onclick="copyJsonToClipboardFromModal()" style="margin-right: 10px;">📋 Копировать JSON</button>
    </div>`;
  }

  modalBody.value = modalContent;
  modalUrl.value = url || '';
  showInfoModalFlag.value = true;
}

function closeModal() {
  showInfoModalFlag.value = false;
  modalBody.value = '';
  currentModalJsonForCopy.value = null;
}

// Функции для модальных окон
async function showUserInfoModal(userId: string) {
  console.log('Show user JSON for:', userId);
  
  const url = `/api/users/${userId}`;
  
  // Показываем загрузку
  showModal('JSON пользователя', '<div class="loading">Загрузка данных пользователя...</div>', url);
  
  try {
    const response = await fetch(url, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('User JSON response:', data);

    if (data.data) {
      // Отображаем данные в формате JSON
      const jsonStr = JSON.stringify(data.data, null, 2);
      showModal(`JSON пользователя: ${escapeHtml(userId)}`, 
        `<div style="max-height: 500px; overflow: auto;">
          <pre class="json-content">${escapeHtml(jsonStr)}</pre>
        </div>`,
        url,
        data.data
      );
    } else {
      showModal('Ошибка', 'Данные пользователя не найдены', url);
    }
  } catch (error) {
    console.error('Error loading user JSON:', error);
    showModal('Ошибка', `Ошибка загрузки: ${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}`, url);
  }
}

async function showUsersUrl() {
  const key = apiKey.value;
  if (!key) {
    alert('API Key не указан');
    return;
  }

  const params = new URLSearchParams({
    page: currentUserPage.value.toString(),
    limit: currentUserLimit.value.toString(),
  });

  if (currentUserFilter.value) {
    params.append('filter', currentUserFilter.value);
  }

  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/users?${params.toString()}`;
  showModal('URL запроса пользователей', `<div class="url-display">${escapeHtml(url)}</div>`, url);
}

async function showCurrentUrl() {
  if (!currentUserId.value) {
    alert('Сначала выберите пользователя');
    return;
  }

  // Строим URL запроса
  let url = `/api/users/${currentUserId.value}/dialogs`;
  const params = new URLSearchParams();
  
  // Добавляем параметры пагинации
  params.append('page', currentDialogPage.value.toString());
  params.append('limit', '10');
  
  // Добавляем фильтр
  if (currentDialogFilter.value) {
    params.append('filter', currentDialogFilter.value);
  }
  
  // Формируем полный URL
  const fullUrl = url + (params.toString() ? '?' + params.toString() : '');
  
  // Получаем правильный базовый URL для tenant-api
  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  const fullUrlWithOrigin = `${baseUrl}${fullUrl}`;
  
  // Показываем в модальном окне
  showModal('Текущий URL запроса', `
    <div class="url-info">
      <h4>API Endpoint:</h4>
      <div class="url-display">${escapeHtml(fullUrl)}</div>
      
      <h4>Параметры:</h4>
      <div class="params-list">
        <div><strong>page:</strong> ${currentDialogPage.value}</div>
        <div><strong>limit:</strong> 10</div>
        ${currentDialogFilter.value ? `<div><strong>filter:</strong> ${escapeHtml(currentDialogFilter.value)}</div>` : ''}
      </div>
      
      <h4>Полный URL для копирования:</h4>
      <div class="url-copy">
        <input type="text" value="${escapeHtml(fullUrlWithOrigin)}" readonly onclick="this.select()" style="width: 100%; padding: 8px; font-family: monospace; font-size: 12px;">
        <button onclick="copyToClipboardFromModal('${escapeHtml(fullUrlWithOrigin)}')" style="margin-top: 8px; padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">📋 Копировать</button>
      </div>
    </div>
  `);
}

async function showCurrentMessageUrl() {
  if (!currentDialogId.value || !currentUserId.value) {
    alert('Сначала выберите диалог');
    return;
  }

  let url = `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages?page=${currentMessagePage.value}&limit=10`;

  if (currentMessageFilter.value) {
    url += `&filter=${encodeURIComponent(currentMessageFilter.value)}`;
  }

  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  const fullUrl = `${baseUrl}${url}`;
  showModal('URL запроса сообщений', `<div class="url-display">${escapeHtml(fullUrl)}</div>`, fullUrl);
}

async function showDialogInfo(dialogId: string) {
  try {
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/dialogs/${dialogId}`;

    const response = await fetch(url, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const dialog = await response.json();
    const dialogData = dialog.data || dialog;

    showModal(
      'Информация о диалоге',
      `<div class="json-content">${JSON.stringify(dialog, null, 2)}</div>`,
      url,
      dialogData
    );
  } catch (error) {
    console.error('Error loading dialog info:', error);
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/dialogs/${dialogId}`;
    showModal('Ошибка', `Не удалось загрузить информацию о диалоге: ${error instanceof Error ? error.message : 'Unknown error'}`, url);
  }
}

async function showMessageInfo(messageId: string) {
  try {
    if (!currentUserId.value || !currentDialogId.value) {
      alert('Сначала выберите пользователя и диалог');
      return;
    }

    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`;

    const response = await fetch(url, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const message = await response.json();
    const messageData = message.data || message;

    showModal(
      'Информация о сообщении',
      `<div class="json-content">${JSON.stringify(message, null, 2)}</div>`,
      url,
      messageData
    );
  } catch (error) {
    console.error('Error loading message info:', error);
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/messages/${messageId}`;
    showModal('Ошибка', `Не удалось загрузить информацию о сообщении: ${error instanceof Error ? error.message : 'Unknown error'}`, url);
  }
}

// Функция для копирования JSON из модального окна (будет вызвана из v-html)
function copyJsonToClipboardFromModal() {
  const jsonText = currentModalJsonForCopy.value;

  if (!jsonText) {
    alert('Нет данных для копирования');
    return;
  }

  navigator.clipboard.writeText(jsonText).then(
    () => {
      // Ищем кнопку в модальном окне
      const modalBody = document.querySelector('.modal-body');
      if (modalBody) {
        const button = modalBody.querySelector('.btn-primary') as HTMLButtonElement;
        if (button) {
          const originalText = button.textContent;
          button.textContent = '✅ Скопировано!';
          button.style.background = '#28a745';
          setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
          }, 2000);
        }
      }
    },
    (err) => {
      console.error('Failed to copy JSON:', err);
      alert('Не удалось скопировать JSON');
    }
  );
}

// Функция для копирования URL в буфер обмена
function copyToClipboardFromModal(text: string) {
  navigator.clipboard.writeText(text).then(
    () => {
      // Находим кнопку и обновляем её текст
      const button = document.querySelector('.url-copy button') as HTMLButtonElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✅ Скопировано!';
        button.style.background = '#28a745';
        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = '#28a745';
        }, 2000);
      }
    },
    (err) => {
      console.error('Failed to copy URL:', err);
      alert('Не удалось скопировать URL');
    }
  );
}

// Добавляем функции в window для вызова из v-html
if (typeof window !== 'undefined') {
  (window as any).copyJsonToClipboardFromModal = copyJsonToClipboardFromModal;
  (window as any).copyToClipboardFromModal = copyToClipboardFromModal;
}

// Функции для модального окна добавления сообщения
async function showAddMessageModal() {
  if (!currentDialogId.value) {
    alert('Сначала выберите диалог');
    return;
  }
  
  if (!currentUserId.value) {
    alert('Сначала выберите пользователя');
    return;
  }
  
  // Сбрасываем форму
  messageSender.value = 'carl';
  messageType.value = 'internal.text';
  messageContent.value = 'тест тест';
  messageTopicId.value = '';
  quotedMessageId.value = '';
  messageMetaTags.value = [{ key: '', value: '' }];
  availableTopics.value = [];
  
  // Загружаем список топиков для диалога
  try {
    const topicsResponse = await fetch(
      `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/topics?page=1&limit=100`,
      {
        headers: credentialsStore.getHeaders(),
      }
    );
    
    if (topicsResponse.ok) {
      const topicsData = await topicsResponse.json();
      if (topicsData.data && topicsData.data.length > 0) {
        availableTopics.value = topicsData.data;
      }
    }
  } catch (error) {
    console.error('Ошибка при загрузке топиков:', error);
  }
  
  showAddMessageModalFlag.value = true;
  updatePayloadJson();
}

function closeAddMessageModal() {
  showAddMessageModalFlag.value = false;
}

function addMetaTagRow() {
  messageMetaTags.value.push({ key: '', value: '' });
  updatePayloadJson();
}

function removeMetaTagRow(index: number) {
  if (messageMetaTags.value.length > 1) {
    messageMetaTags.value.splice(index, 1);
    updatePayloadJson();
  }
}

function collectMetaTags(): Record<string, string> | null {
  const metaTags: Record<string, string> = {};
  messageMetaTags.value.forEach((tag) => {
    if (tag.key.trim() && tag.value.trim()) {
      metaTags[tag.key.trim()] = tag.value.trim();
    }
  });
  return Object.keys(metaTags).length > 0 ? metaTags : null;
}

function updatePayloadJson() {
  const meta = collectMetaTags();
  
  const payload: any = {
    senderId: messageSender.value,
    type: messageType.value,
    content: messageContent.value,
  };
  
  if (quotedMessageId.value.trim()) {
    payload.quotedMessageId = quotedMessageId.value.trim();
  }
  
  if (messageTopicId.value.trim()) {
    payload.topicId = messageTopicId.value.trim();
  }
  
  if (meta) {
    payload.meta = meta;
  }
  
  payloadJson.value = JSON.stringify(payload, null, 2);
}

async function submitAddMessage() {
  if (!currentDialogId.value || !currentUserId.value) {
    alert('Ошибка: не выбран диалог или пользователь');
    return;
  }

  const meta = collectMetaTags();

  try {
    const payload: any = {
      senderId: messageSender.value,
      type: messageType.value,
      content: messageContent.value,
    };
    
    if (quotedMessageId.value.trim()) {
      payload.quotedMessageId = quotedMessageId.value.trim();
    }
    
    if (messageTopicId.value.trim()) {
      payload.topicId = messageTopicId.value.trim();
    }
    
    if (meta) {
      payload.meta = meta;
    }

    const response = await fetch(`/api/dialogs/${currentDialogId.value}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...credentialsStore.getHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Message added successfully:', result);
    
    alert('Сообщение успешно добавлено!');
    
    closeAddMessageModal();
    
    // Обновляем список сообщений
    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, currentMessagePage.value);
    }
  } catch (error) {
    console.error('Error adding message:', error);
    alert(`Ошибка при добавлении сообщения: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Функции для модального окна реакций
async function showReactionModal(messageId: string) {
  if (!currentUserId.value) {
    alert('Сначала выберите пользователя');
    return;
  }
  
  if (!currentDialogId.value) {
    alert('Сначала выберите диалог');
    return;
  }
  
  currentMessageIdForReaction.value = messageId;
  showReactionModalFlag.value = true;
  await loadExistingReactions(messageId);
}

function closeReactionModal() {
  showReactionModalFlag.value = false;
  currentMessageIdForReaction.value = null;
  existingReactions.value = [];
}

async function loadExistingReactions(messageId: string) {
  try {
    const response = await fetch(
      `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`,
      {
        headers: credentialsStore.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const message = data.data || {};
    const reactionSet = message.reactionSet || [];
    
    existingReactions.value = reactionSet;
  } catch (error) {
    console.error('Error loading reactions:', error);
    existingReactions.value = [];
  }
}

async function toggleReaction(reaction: string) {
  if (!currentMessageIdForReaction.value || !currentUserId.value || !currentDialogId.value) {
    alert('Ошибка: не выбран сообщение, пользователь или диалог');
    return;
  }

  // Проверяем, есть ли уже эта реакция у пользователя
  const existingReaction = existingReactions.value.find((r: any) => r.reaction === reaction);
  const isActive = existingReaction && existingReaction.me;

  try {
    const action = isActive ? 'unset' : 'set';
    
    const response = await fetch(
      `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${currentMessageIdForReaction.value}/reactions/${action}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify({
          reaction: reaction,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(isActive ? 'Reaction unset:' : 'Reaction set:', data);
    
    // Обновляем список реакций
    await loadExistingReactions(currentMessageIdForReaction.value);
    
    // Обновляем список сообщений
    if (currentDialogId.value) {
      loadDialogMessages(currentDialogId.value, currentMessagePage.value);
    }
  } catch (error) {
    console.error('Error toggling reaction:', error);
    alert(`Ошибка при ${isActive ? 'снятии' : 'установке'} реакции: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Функции для модального окна событий сообщения
async function showEventsModal(messageId: string) {
  if (!currentUserId.value) {
    alert('Сначала выберите пользователя');
    return;
  }
  
  if (!currentDialogId.value) {
    alert('Сначала выберите диалог');
    return;
  }
  
  currentMessageIdForEvents.value = messageId;
  showEventsModalFlag.value = true;
  eventUpdates.value = [];
  await loadMessageEvents(messageId);
}

function closeEventsModal() {
  showEventsModalFlag.value = false;
  currentMessageIdForEvents.value = null;
  events.value = [];
  eventUpdates.value = [];
  selectedEventId.value = null;
}

async function loadMessageEvents(messageId: string) {
  try {
    loadingEvents.value = true;
    eventsError.value = null;
    
    const url = `/api/messages/${messageId}/events?tenantId=${encodeURIComponent(tenantId.value)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Tenant-Id': tenantId.value,
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        events.value = [];
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const eventsList = Array.isArray(data.data) ? data.data : (Array.isArray(data.events) ? data.events : []);
    events.value = eventsList;
  } catch (error) {
    console.error('Error loading events:', error);
    eventsError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
    events.value = [];
  } finally {
    loadingEvents.value = false;
  }
}

function getEventId(event: any): string {
  if (event._id) {
    if (typeof event._id === 'object') {
      if (event._id.toString && typeof event._id.toString === 'function') {
        return event._id.toString();
      } else if (event._id.$oid) {
        return event._id.$oid;
      }
      return String(event._id);
    }
    return String(event._id);
  }
  return String(event.id || '');
}

function formatEventTime(timestamp: any): string {
  if (!timestamp) return '-';
  const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
  return new Date(ts).toLocaleString('ru-RU');
}

function getEventDescription(eventType: string, data: any): string {
  const descriptions: Record<string, string> = {
    'dialog.create': 'Создан диалог',
    'dialog.update': 'Обновлен диалог',
    'dialog.delete': 'Удален диалог',
    'message.create': 'Создано сообщение',
    'message.update': 'Обновлено сообщение',
    'dialog.member.add': 'Добавлен участник диалога',
    'dialog.member.remove': 'Удален участник диалога',
    'dialog.member.update': 'Обновлен участник диалога',
    'message.status.update': 'Обновлен статус сообщения',
    'message.reaction.update': 'Обновлена реакция на сообщение',
    'dialog.typing': 'Пользователь печатает в диалоге',
  };
  
  let description = descriptions[eventType] || eventType;
  
  if (data) {
    if (data.message?.content) {
      description += `: "${data.message.content.substring(0, 50)}${data.message.content.length > 50 ? '...' : ''}"`;
    } else if (data.member?.userId) {
      description += `: пользователь ${data.member.userId}`;
    } else if (data.statusUpdate?.status) {
      description += `: статус "${data.statusUpdate.status}"`;
    } else if (data.reactionUpdate?.reaction) {
      description += `: реакция "${data.reactionUpdate.reaction}"`;
    }
  }
  
  return description;
}

async function loadEventUpdates(eventId: string) {
  if (!currentMessageIdForEvents.value) return;
  
  try {
    const url = `/api/messages/${currentMessageIdForEvents.value}/updates?tenantId=${encodeURIComponent(tenantId.value)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Tenant-Id': tenantId.value,
      },
    });
    
    if (!response.ok) {
      eventUpdates.value = [];
      return;
    }
    
    const data = await response.json();
    const allUpdates = Array.isArray(data.data) ? data.data : [];
    
    const eventIdStr = String(eventId).trim();
    const filteredUpdates = allUpdates.filter((update: any) => {
      if (!update.eventId) return false;
      let updateEventId: string;
      if (typeof update.eventId === 'object') {
        if (update.eventId.toString && typeof update.eventId.toString === 'function') {
          updateEventId = update.eventId.toString();
        } else if (update.eventId.$oid) {
          updateEventId = update.eventId.$oid;
        } else {
          updateEventId = String(update.eventId);
        }
      } else {
        updateEventId = String(update.eventId);
      }
      return updateEventId.trim() === eventIdStr;
    });
    
    eventUpdates.value = filteredUpdates;
    selectedEventId.value = eventId;
  } catch (error) {
    console.error('Error loading event updates:', error);
    eventUpdates.value = [];
  }
}

// Функции для модального окна матрицы статусов
async function showStatusMatrixModal(messageId: string) {
  if (!currentUserId.value) {
    alert('Сначала выберите пользователя');
    return;
  }
  
  if (!currentDialogId.value) {
    alert('Сначала выберите диалог');
    return;
  }
  
  showStatusMatrixModalFlag.value = true;
  
  await nextTick();
  
  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`;
  
  const urlElement = document.getElementById('statusMatrixUrl');
  if (urlElement) {
    urlElement.textContent = url;
  }
  loadingStatusMatrix.value = true;
  statusMatrixError.value = null;
  
  try {
    const response = await fetch(
      `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`,
      {
        headers: credentialsStore.getHeaders(),
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        statusMatrix.value = [];
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const message = data.data || {};
    statusMatrix.value = message.statusMessageMatrix || [];
  } catch (error) {
    console.error('Error loading status matrix:', error);
    statusMatrixError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
    statusMatrix.value = [];
  } finally {
    loadingStatusMatrix.value = false;
  }
}

function closeStatusMatrixModal() {
  showStatusMatrixModalFlag.value = false;
  statusMatrix.value = [];
}

// Функции для модального окна статусов
async function showStatusesModal(messageId: string) {
  if (!currentUserId.value) {
    alert('Сначала выберите пользователя');
    return;
  }
  
  if (!currentDialogId.value) {
    alert('Сначала выберите диалог');
    return;
  }
  
  currentMessageIdForStatuses.value = messageId;
  currentStatusesPage.value = 1;
  currentStatusesLimit.value = 50;
  
  showStatusesModalFlag.value = true;
  
  await nextTick();
  
  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}/statuses?page=${currentStatusesPage.value}&limit=${currentStatusesLimit.value}`;
  
  const urlElement = document.getElementById('statusesUrl');
  if (urlElement) {
    urlElement.textContent = url;
  }
  await loadStatuses(messageId, currentStatusesPage.value, currentStatusesLimit.value);
}

function closeStatusesModal() {
  showStatusesModalFlag.value = false;
  currentMessageIdForStatuses.value = null;
  statuses.value = [];
  currentStatusesPage.value = 1;
}

async function loadStatuses(messageId: string, page: number, limit: number) {
  if (!currentUserId.value || !currentDialogId.value) {
    return;
  }
  
  loadingStatuses.value = true;
  statusesError.value = null;
  
  await nextTick();
  
  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}/statuses?page=${page}&limit=${limit}`;
  
  const urlElement = document.getElementById('statusesUrl');
  if (urlElement) {
    urlElement.textContent = url;
  }
  
  try {
    const response = await fetch(
      `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}/statuses?page=${page}&limit=${limit}`,
      {
        headers: credentialsStore.getHeaders(),
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        statuses.value = [];
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    statuses.value = data.data || [];
    const pagination = data.pagination || {};
    totalStatuses.value = pagination.total || 0;
    totalStatusesPages.value = pagination.pages || 1;
    currentStatusesPage.value = page;
  } catch (error) {
    console.error('Error loading statuses:', error);
    statusesError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
    statuses.value = [];
  } finally {
    loadingStatuses.value = false;
  }
}

function goToStatusesPage(page: number) {
  if (currentMessageIdForStatuses.value) {
    loadStatuses(currentMessageIdForStatuses.value, page, currentStatusesLimit.value);
  }
}

// Функции для модального окна установки статуса
async function showSetStatusModal(messageId: string) {
  if (!currentUserId.value) {
    alert('Сначала выберите пользователя');
    return;
  }
  
  if (!currentDialogId.value) {
    alert('Сначала выберите диалог');
    return;
  }
  
  currentMessageIdForSetStatus.value = messageId;
  
  showSetStatusModalFlag.value = true;
  
  await nextTick();
  
  let url = `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}/status/`;
  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  const fullUrl = `${baseUrl}${url}{status}`;
  
  const urlElement = document.getElementById('setStatusUrl');
  if (urlElement) {
    urlElement.textContent = fullUrl;
  }
  
  const resultDiv = document.getElementById('setStatusResult');
  if (resultDiv) {
    resultDiv.style.display = 'none';
    resultDiv.innerHTML = '';
  }
}

function closeSetStatusModal() {
  showSetStatusModalFlag.value = false;
  currentMessageIdForSetStatus.value = null;
  setStatusResult.value = '';
}

async function setMessageStatus(status: string) {
  if (!currentMessageIdForSetStatus.value || !currentUserId.value || !currentDialogId.value) {
    alert('Ошибка: не выбран сообщение, пользователь или диалог');
    return;
  }
  
  const resultDiv = document.getElementById('setStatusResult');
  if (resultDiv) {
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="loading">Установка статуса...</div>';
  }
  
  try {
    const url = `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${currentMessageIdForSetStatus.value}/status/${status}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: credentialsStore.getHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Status set successfully:', data);
    
    if (resultDiv) {
      resultDiv.innerHTML = `
        <div style="padding: 15px; background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; color: #155724;">
          <strong>✓ Статус успешно установлен!</strong><br>
          Статус: <strong>${status}</strong><br>
          <small style="color: #666;">Сообщение обновлено</small>
        </div>
      `;
    }
    
    // Обновляем список сообщений
    if (currentDialogId.value) {
      setTimeout(() => {
        loadDialogMessages(currentDialogId.value!, currentMessagePage.value);
      }, 500);
    }
    
    // Закрываем модальное окно через 2 секунды
    setTimeout(() => {
      closeSetStatusModal();
    }, 2000);
  } catch (error) {
    console.error('Error setting status:', error);
    if (resultDiv) {
      resultDiv.innerHTML = `
        <div style="padding: 15px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; color: #721c24;">
          <strong>✗ Ошибка при установке статуса</strong><br>
          ${error instanceof Error ? error.message : 'Unknown error'}
        </div>
      `;
    }
  }
}

// Функции для модального окна событий диалога
async function showDialogEventsModal(dialogId: string) {
  currentDialogIdForEvents.value = dialogId;
  showDialogEventsModalFlag.value = true;
  dialogEventUpdates.value = [];
  await loadDialogEvents(dialogId);
}

function closeDialogEventsModal() {
  showDialogEventsModalFlag.value = false;
  currentDialogIdForEvents.value = null;
  dialogEvents.value = [];
  dialogEventUpdates.value = [];
  selectedDialogEventId.value = null;
}

async function loadDialogEvents(dialogId: string) {
  try {
    loadingDialogEvents.value = true;
    dialogEventsError.value = null;
    
    // Используем getControlApiUrl для /events (события идут в control-api)
    let url = `/api/dialogs/${dialogId}/events?tenantId=${encodeURIComponent(tenantId.value)}`;
    // В оригинале используется getControlApiUrl для формирования полного URL
    if (typeof window !== 'undefined' && (window as any).CHAT3_CONFIG && (window as any).CHAT3_CONFIG.getControlApiUrl) {
      url = (window as any).CHAT3_CONFIG.getControlApiUrl(`/api/dialogs/${dialogId}/events?tenantId=${encodeURIComponent(tenantId.value)}`);
    } else {
      // Fallback: используем относительный путь, который должен проксироваться
      // Прокси настроен в vite.config.ts и server/index.ts для /api/dialogs с /events
    }
    
    console.log('Запрос событий диалога к:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Tenant-Id': tenantId.value,
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        dialogEvents.value = [];
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    dialogEvents.value = Array.isArray(data.data) ? data.data : [];
  } catch (error) {
    console.error('Error loading dialog events:', error);
    dialogEventsError.value = error instanceof Error ? error.message : 'Ошибка загрузки';
    dialogEvents.value = [];
  } finally {
    loadingDialogEvents.value = false;
  }
}

function getDialogEventId(event: any): string | null {
  if (event._id) {
    if (typeof event._id === 'object') {
      if (event._id.toString && typeof event._id.toString === 'function') {
        return event._id.toString().trim();
      } else if (event._id.$oid) {
        return String(event._id.$oid).trim();
      }
      return String(event._id).trim();
    }
    return String(event._id).trim();
  } else if (event.id) {
    return String(event.id).trim();
  }
  return null;
}

function getUpdateId(update: any): string {
  if (update._id) {
    if (typeof update._id === 'object') {
      if (update._id.toString && typeof update._id.toString === 'function') {
        return update._id.toString();
      } else if (update._id.$oid) {
        return String(update._id.$oid);
      }
      return String(update._id);
    }
    return String(update._id);
  } else if (update.id) {
    return String(update.id);
  }
  return `${update.createdAt}-${update.eventType}-${update.userId}`;
}

function getDialogEventDescription(eventType: string, data: any): string {
  const descriptions: Record<string, string> = {
    'dialog.create': 'Создан диалог',
    'dialog.update': 'Обновлен диалог',
    'dialog.delete': 'Удален диалог',
    'dialog.member.add': 'Добавлен участник диалога',
    'dialog.member.remove': 'Удален участник диалога',
    'dialog.member.update': 'Обновлен участник диалога',
    'message.create': 'Создано сообщение',
    'message.update': 'Обновлено сообщение',
    'message.delete': 'Удалено сообщение',
    'message.status.update': 'Обновлен статус сообщения',
    'message.reaction.update': 'Обновлена реакция на сообщение',
    'dialog.typing': 'Пользователь печатает в диалоге',
  };
  
  let description = descriptions[eventType] || eventType;
  
  if (data) {
    if (data.message?.content) {
      description += `: "${data.message.content.substring(0, 50)}${data.message.content.length > 50 ? '...' : ''}"`;
    } else if (data.member?.userId) {
      description += `: пользователь ${data.member.userId}`;
    } else if (data.dialog?.dialogId) {
      description += `: "${data.dialog.dialogId}"`;
    }
  }
  
  return description;
}

async function loadAllDialogUpdatesInModal(dialogId: string, eventId: string) {
  try {
    // Устанавливаем выбранное событие
    selectedDialogEventId.value = eventId;
    
    // Используем getControlApiUrl для /updates (обновления идут в control-api)
    let url = `/api/dialogs/${dialogId}/updates?tenantId=${encodeURIComponent(tenantId.value)}`;
    if (typeof window !== 'undefined' && (window as any).CHAT3_CONFIG && (window as any).CHAT3_CONFIG.getControlApiUrl) {
      url = (window as any).CHAT3_CONFIG.getControlApiUrl(`/api/dialogs/${dialogId}/updates?tenantId=${encodeURIComponent(tenantId.value)}`);
    }
    
    console.log('Запрос обновлений диалога к:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Tenant-Id': tenantId.value,
      },
    });
    
    if (!response.ok) {
      let errorMessage = '';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || '';
      } catch (e) {
        errorMessage = `HTTP ${response.status}`;
      }
      dialogEventUpdates.value = [];
      console.error('Ошибка загрузки обновлений диалога:', errorMessage);
      return;
    }
    
    const data = await response.json();
    const updates = Array.isArray(data.data) ? data.data : [];
    
    if (updates.length === 0) {
      dialogEventUpdates.value = [];
      return;
    }
    
    // В оригинале загружаются все обновления диалога, а не фильтруются по eventId
    dialogEventUpdates.value = updates;
  } catch (error) {
    console.error('Error loading dialog event updates:', error);
    dialogEventUpdates.value = [];
  }
}

// Функции для модального окна мета-тегов диалога
async function showDialogMetaModal(dialogId: string) {
  dialogMetaDialogId.value = dialogId;
  showDialogMetaModalFlag.value = true;
  await loadDialogMetaTags(dialogId);
}

function closeDialogMetaModal() {
  showDialogMetaModalFlag.value = false;
  dialogMetaDialogId.value = '';
  dialogMetaTags.value = {};
  newDialogMetaKey.value = '';
  newDialogMetaValue.value = '';
}

async function loadDialogMetaTags(dialogId: string) {
  try {
    loadingDialogMeta.value = true;
    const response = await fetch(`/api/meta/dialog/${dialogId}`, {
      headers: credentialsStore.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to load dialog meta');
    }
    
    const { data: meta } = await response.json();
    dialogMetaTags.value = meta || {};
  } catch (error) {
    console.error('Error loading dialog meta tags:', error);
    dialogMetaTags.value = {};
  } finally {
    loadingDialogMeta.value = false;
  }
}

async function addDialogMetaTag() {
  const dialogId = dialogMetaDialogId.value;
  const key = newDialogMetaKey.value.trim();
  const valueStr = newDialogMetaValue.value.trim();
  
  if (!key || !valueStr) {
    alert('Заполните ключ и значение');
    return;
  }
  
  let value: any;
  try {
    value = JSON.parse(valueStr);
  } catch (e) {
    value = valueStr;
  }
  
  try {
    const response = await fetch(`/api/meta/dialog/${dialogId}/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...credentialsStore.getHeaders(),
      },
      body: JSON.stringify({ value }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to set meta tag');
    }
    
    newDialogMetaKey.value = '';
    newDialogMetaValue.value = '';
    await loadDialogMetaTags(dialogId);
    alert('Meta тег успешно добавлен!');
  } catch (error) {
    console.error('Error adding dialog meta tag:', error);
    alert(`Ошибка добавления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function deleteDialogMetaTag(key: string) {
  if (!confirm(`Удалить meta тег "${key}"?`)) {
    return;
  }
  
  const dialogId = dialogMetaDialogId.value;
  try {
    const response = await fetch(`/api/meta/dialog/${dialogId}/${key}`, {
      method: 'DELETE',
      headers: credentialsStore.getHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete meta tag');
    }
    
    await loadDialogMetaTags(dialogId);
    alert('Meta тег успешно удален!');
  } catch (error) {
    console.error('Error deleting dialog meta tag:', error);
    alert(`Ошибка удаления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Функции для модального окна добавления участника
async function showAddMemberModal() {
  if (!currentDialogId.value) {
    alert('Ошибка: не выбран диалог');
    return;
  }
  
  newMemberSelect.value = '';
  newMemberType.value = '';
  newMemberMetaTags.value = [{ key: '', value: '' }];
  availableUsersForMember.value = [];
  
  try {
    const response = await fetch(`/api/users?limit=100`, {
      headers: credentialsStore.getHeaders(),
    });
    
    if (response.ok) {
      const data = await response.json();
      availableUsersForMember.value = Array.isArray(data.data) ? data.data : [];
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
  
  showAddMemberModalFlag.value = true;
}

function closeAddMemberModal() {
  showAddMemberModalFlag.value = false;
  newMemberSelect.value = '';
  newMemberType.value = '';
  newMemberMetaTags.value = [{ key: '', value: '' }];
}

function addMemberMetaRow() {
  newMemberMetaTags.value.push({ key: '', value: '' });
}

function removeMemberMetaRow(index: number) {
  if (newMemberMetaTags.value.length > 1) {
    newMemberMetaTags.value.splice(index, 1);
  } else {
    newMemberMetaTags.value[0] = { key: '', value: '' };
  }
}

function collectMemberMetaTags(): Record<string, string> {
  const meta: Record<string, string> = {};
  newMemberMetaTags.value.forEach((tag) => {
    if (tag.key.trim() && tag.value.trim()) {
      meta[tag.key.trim()] = tag.value.trim();
    }
  });
  return meta;
}

async function submitAddMember() {
  if (!currentDialogId.value) {
    alert('Ошибка: не выбран диалог');
    return;
  }
  
  const userId = newMemberSelect.value;
  const type = newMemberType.value;
  const meta = collectMemberMetaTags();
  
  if (!userId) {
    alert('Пожалуйста, выберите пользователя');
    return;
  }
  
  try {
    // Подготавливаем тело запроса
    const requestBody: any = { userId };
    if (type) {
      requestBody.type = type;
    }

    const response = await fetch(`/api/dialogs/${currentDialogId.value}/members/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...credentialsStore.getHeaders(),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } else {
          const errorText = await response.text();
          if (errorText && !errorText.startsWith('<!DOCTYPE')) {
            errorMessage = errorText;
          }
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('Member added successfully:', result);
    
    // Если есть мета-теги, добавляем их отдельно
    if (Object.keys(meta).length > 0) {
      try {
        // Используем API для установки мета-тегов участника
        // Формат: /api/meta/dialogMember/{dialogId}:{userId}/{key}
        const entityId = `${currentDialogId.value}:${userId}`;
        for (const [key, value] of Object.entries(meta)) {
          const metaResponse = await fetch(`/api/meta/dialogMember/${entityId}/${key}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...credentialsStore.getHeaders(),
            },
            body: JSON.stringify({ value, dataType: 'string' }),
          });
          
          if (!metaResponse.ok) {
            console.warn(`Failed to set meta tag ${key}:`, await metaResponse.text());
          }
        }
      } catch (metaError) {
        console.error('Error setting meta tags:', metaError);
        // Не прерываем процесс, просто логируем ошибку
      }
    }
    
    alert('Участник успешно добавлен!');
    closeAddMemberModal();
    
    // Обновляем список участников
    if (currentViewMode.value === 'members') {
      await loadDialogMembers(currentDialogId.value, currentMemberPage.value);
    }
  } catch (error) {
    console.error('Error adding member:', error);
    alert(`Ошибка при добавлении участника: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Функции для модального окна создания топика
async function showAddTopicModal() {
  if (!currentDialogId.value) {
    alert('Ошибка: не выбран диалог');
    return;
  }
  
  newTopicMetaTags.value = [{ key: '', value: '' }];
  showAddTopicModalFlag.value = true;
}

function closeAddTopicModal() {
  showAddTopicModalFlag.value = false;
  newTopicMetaTags.value = [{ key: '', value: '' }];
}

function addTopicMetaRow() {
  newTopicMetaTags.value.push({ key: '', value: '' });
}

function removeTopicMetaRow(index: number) {
  if (newTopicMetaTags.value.length > 1) {
    newTopicMetaTags.value.splice(index, 1);
  } else {
    newTopicMetaTags.value[0] = { key: '', value: '' };
  }
}

function collectTopicMetaTags(): Record<string, string> {
  const meta: Record<string, string> = {};
  newTopicMetaTags.value.forEach((tag) => {
    if (tag.key.trim() && tag.value.trim()) {
      meta[tag.key.trim()] = tag.value.trim();
    }
  });
  return meta;
}

async function submitAddTopic() {
  if (!currentDialogId.value) {
    alert('Ошибка: не выбран диалог');
    return;
  }
  
  const meta = collectTopicMetaTags();
  
  try {
    const requestBody: any = {};
    if (Object.keys(meta).length > 0) {
      requestBody.meta = meta;
    }
    
    const response = await fetch(`/api/dialogs/${currentDialogId.value}/topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...credentialsStore.getHeaders(),
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } else {
          const errorText = await response.text();
          if (errorText) errorMessage = errorText;
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
      alert(`Ошибка при создании топика: ${errorMessage}`);
      return;
    }
    
    const result = await response.json();
    console.log('Topic created:', result);
    
    closeAddTopicModal();
    
    // Обновляем список топиков
    if (currentViewMode.value === 'topics' && currentDialogId.value) {
      await loadDialogTopics(currentDialogId.value, currentTopicsPage.value);
    }
    
    alert('Топик успешно создан!');
  } catch (error) {
    console.error('Error creating topic:', error);
    alert(`Ошибка при создании топика: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Функции для модального окна мета-тегов участника
async function showMemberMetaModal(dialogId: string, userId: string) {
  memberMetaModalDialogId.value = dialogId;
  memberMetaModalUserId.value = userId;
  memberMetaStatus.value = '';
  
  try {
    const response = await fetch(`/api/dialogs/${dialogId}/members?filter=(userId,eq,${userId})`, {
      headers: credentialsStore.getHeaders(),
    });
    
    if (response.ok) {
      const data = await response.json();
      const members = Array.isArray(data.data) ? data.data : [];
      const member = members.find((m: any) => m.userId === userId);
      const meta = member?.meta || {};
      currentMemberMetaOriginal.value = JSON.parse(JSON.stringify(meta));
      
      memberMetaTags.value = Object.keys(meta).map((key) => ({
        key,
        value: formatMetaValueForInput(meta[key]),
        isExisting: true,
      }));
    } else {
      currentMemberMetaOriginal.value = {};
      memberMetaTags.value = [];
    }
  } catch (error) {
    console.error('Error loading member meta:', error);
    currentMemberMetaOriginal.value = {};
    memberMetaTags.value = [];
  }
  
  showMemberMetaModalFlag.value = true;
}

function closeMemberMetaModal() {
  showMemberMetaModalFlag.value = false;
  memberMetaModalDialogId.value = '';
  memberMetaModalUserId.value = '';
  memberMetaTags.value = [];
  currentMemberMetaOriginal.value = {};
  memberMetaStatus.value = '';
}

function addMemberMetaRowModal() {
  memberMetaTags.value.push({ key: '', value: '', isExisting: false });
}

function removeMemberMetaRowModal(index: number) {
  memberMetaTags.value.splice(index, 1);
  if (memberMetaTags.value.length === 0) {
    memberMetaTags.value = [];
  }
}

function formatMetaValueForInput(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseMetaValueFromInput(inputValue: string): any {
  if (!inputValue || inputValue.trim() === '') return null;
  const trimmed = inputValue.trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    return trimmed;
  }
}

function collectMemberMetaTagsModal(): Record<string, any> {
  const meta: Record<string, any> = {};
  memberMetaTags.value.forEach((tag) => {
    if (tag.key.trim()) {
      meta[tag.key.trim()] = parseMetaValueFromInput(tag.value);
    }
  });
  return meta;
}

async function saveMemberMetaChangesModal() {
  if (!memberMetaModalDialogId.value || !memberMetaModalUserId.value) {
    alert('Ошибка: не выбран диалог или участник');
    return;
  }
  
  const newMeta = collectMemberMetaTagsModal();
  memberMetaStatus.value = '';
  
  try {
    // Удаляем старые мета-теги
    const oldKeys = Object.keys(currentMemberMetaOriginal.value);
    for (const key of oldKeys) {
      if (!(key in newMeta)) {
        await fetch(`/api/dialogs/${memberMetaModalDialogId.value}/members/${memberMetaModalUserId.value}/meta/${key}`, {
          method: 'DELETE',
          headers: credentialsStore.getHeaders(),
        });
      }
    }
    
    // Добавляем/обновляем новые мета-теги
    for (const [key, value] of Object.entries(newMeta)) {
      const oldValue = currentMemberMetaOriginal.value[key];
      if (oldValue !== value) {
        await fetch(`/api/dialogs/${memberMetaModalDialogId.value}/members/${memberMetaModalUserId.value}/meta/${key}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...credentialsStore.getHeaders(),
          },
          body: JSON.stringify({ value }),
        });
      }
    }
    
    memberMetaStatus.value = 'Мета-теги успешно сохранены';
    
    // Обновляем список участников
    if (currentDialogId.value === memberMetaModalDialogId.value) {
      await loadDialogMembers(currentDialogId.value, currentMemberPage.value);
    }
    
    // Обновляем оригинальные значения
    currentMemberMetaOriginal.value = JSON.parse(JSON.stringify(newMeta));
    
    setTimeout(() => {
      memberMetaStatus.value = '';
    }, 3000);
  } catch (error) {
    console.error('Error saving member meta:', error);
    memberMetaStatus.value = `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Функции для модального окна мета-тегов сообщения
async function showMessageMetaModal(messageId: string) {
  if (!currentUserId.value || !currentDialogId.value) {
    alert('Сначала выберите пользователя и диалог');
    return;
  }
  
  messageMetaMessageId.value = messageId;
  showMessageMetaModalFlag.value = true;
  await loadMessageMetaTags(messageId);
}

function closeMessageMetaModal() {
  showMessageMetaModalFlag.value = false;
  messageMetaMessageId.value = '';
  messageMetaTagsData.value = {};
  newMessageMetaKey.value = '';
  newMessageMetaValue.value = '';
}

async function loadMessageMetaTags(messageId: string) {
  if (!currentUserId.value || !currentDialogId.value) {
    return;
  }
  
  try {
    loadingMessageMeta.value = true;
    const response = await fetch(
      `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/messages/${messageId}`,
      {
        headers: credentialsStore.getHeaders(),
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to load message meta');
    }
    
    const { data: message } = await response.json();
    messageMetaTagsData.value = message.meta || {};
  } catch (error) {
    console.error('Error loading message meta tags:', error);
    messageMetaTagsData.value = {};
  } finally {
    loadingMessageMeta.value = false;
  }
}

async function addMessageMetaTag() {
  const messageId = messageMetaMessageId.value;
  const key = newMessageMetaKey.value.trim();
  const valueStr = newMessageMetaValue.value.trim();
  
  if (!key || !valueStr) {
    alert('Заполните ключ и значение');
    return;
  }
  
  let value: any;
  try {
    value = JSON.parse(valueStr);
  } catch (e) {
    value = valueStr;
  }
  
  try {
    const response = await fetch(`/api/meta/message/${messageId}/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...credentialsStore.getHeaders(),
      },
      body: JSON.stringify({ value }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to set meta tag');
    }
    
    newMessageMetaKey.value = '';
    newMessageMetaValue.value = '';
    await loadMessageMetaTags(messageId);
    alert('Meta тег успешно добавлен!');
  } catch (error) {
    console.error('Error adding message meta tag:', error);
    alert(`Ошибка добавления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function deleteMessageMetaTag(key: string) {
  if (!confirm(`Удалить meta тег "${key}"?`)) {
    return;
  }
  
  const messageId = messageMetaMessageId.value;
  try {
    const response = await fetch(`/api/meta/message/${messageId}/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: credentialsStore.getHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete meta tag');
    }
    
    await loadMessageMetaTags(messageId);
    alert('Meta тег успешно удален!');
  } catch (error) {
    console.error('Error deleting message meta tag:', error);
    alert(`Ошибка удаления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Функции для модального окна мета-тегов топика
async function showTopicMetaModal(dialogId: string, topicId: string) {
  topicMetaDialogId.value = dialogId;
  topicMetaTopicId.value = topicId;
  showTopicMetaModalFlag.value = true;
  await loadTopicMetaTags(dialogId, topicId);
}

function closeTopicMetaModal() {
  showTopicMetaModalFlag.value = false;
  topicMetaDialogId.value = '';
  topicMetaTopicId.value = '';
  topicMetaTags.value = {};
  newTopicMetaKey.value = '';
  newTopicMetaValue.value = '';
}

async function loadTopicMetaTags(dialogId: string, topicId: string) {
  try {
    loadingTopicMeta.value = true;
    const response = await fetch(`/api/dialogs/${dialogId}/topics/${topicId}`, {
      headers: credentialsStore.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to load topic meta');
    }
    
    const { data: topic } = await response.json();
    topicMetaTags.value = topic.meta || {};
  } catch (error) {
    console.error('Error loading topic meta tags:', error);
    topicMetaTags.value = {};
  } finally {
    loadingTopicMeta.value = false;
  }
}

async function addTopicMetaTag() {
  const dialogId = topicMetaDialogId.value;
  const topicId = topicMetaTopicId.value;
  const key = newTopicMetaKey.value.trim();
  const valueStr = newTopicMetaValue.value.trim();
  
  if (!key || !valueStr) {
    alert('Заполните ключ и значение');
    return;
  }
  
  let value: any;
  try {
    value = JSON.parse(valueStr);
  } catch (e) {
    value = valueStr;
  }
  
  try {
    const response = await fetch(`/api/meta/topic/${topicId}/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...credentialsStore.getHeaders(),
      },
      body: JSON.stringify({ value }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to set meta tag');
    }
    
    newTopicMetaKey.value = '';
    newTopicMetaValue.value = '';
    await loadTopicMetaTags(dialogId, topicId);
    // Обновляем список топиков
    if (currentViewMode.value === 'topics' && currentDialogId.value === dialogId) {
      await loadDialogTopics(dialogId, currentTopicsPage.value);
    }
    alert('Meta тег успешно добавлен!');
  } catch (error) {
    console.error('Error adding topic meta tag:', error);
    alert(`Ошибка добавления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function deleteTopicMetaTag(key: string) {
  if (!confirm(`Удалить meta тег "${key}"?`)) {
    return;
  }
  
  const dialogId = topicMetaDialogId.value;
  const topicId = topicMetaTopicId.value;
  try {
    const response = await fetch(`/api/meta/topic/${topicId}/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: credentialsStore.getHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete meta tag');
    }
    
    await loadTopicMetaTags(dialogId, topicId);
    // Обновляем список топиков
    if (currentViewMode.value === 'topics' && currentDialogId.value === dialogId) {
      await loadDialogTopics(dialogId, currentTopicsPage.value);
    }
    alert('Meta тег успешно удален!');
  } catch (error) {
    console.error('Error deleting topic meta tag:', error);
    alert(`Ошибка удаления meta тега: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Функции для участников
function selectMemberFilterExamplePanel() {
  if (selectedMemberFilterExample.value && selectedMemberFilterExample.value !== 'custom') {
    memberFilterInput.value = selectedMemberFilterExample.value;
  } else if (selectedMemberFilterExample.value === 'custom') {
    memberFilterInput.value = '';
  }
}

async function clearMemberFilterFieldPanel() {
  memberFilterInput.value = '';
  selectedMemberFilterExample.value = '';
  currentMemberFilter.value = '';
  if (currentDialogId.value) {
    currentMemberPage.value = 1;
    await loadDialogMembers(currentDialogId.value, 1);
  }
}

async function applyMemberFilterPanel() {
  if (!currentDialogId.value) {
    alert('Сначала выберите диалог');
    return;
  }
  currentMemberFilter.value = memberFilterInput.value.trim();
  currentMemberPage.value = 1;
  await loadDialogMembers(currentDialogId.value, 1);
}

function changeMemberPage(page: number) {
  if (currentDialogId.value) {
    loadDialogMembers(currentDialogId.value, page);
  }
}

async function removeMemberFromPanel(dialogId: string, userId: string) {
  if (!confirm(`Удалить участника ${userId} из диалога?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/dialogs/${dialogId}/members/${userId}/remove`, {
      method: 'POST',
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    alert(`Пользователь ${userId} успешно удален из диалога!`);
    
    // Обновляем список участников
    await loadDialogMembers(dialogId, currentMemberPage.value);
  } catch (error) {
    console.error('Error removing member:', error);
    alert(`Ошибка при удалении участника: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


function generateMembersApiUrl(dialogId: string): string {
  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  const params = new URLSearchParams({
    page: currentMemberPage.value.toString(),
    limit: '10',
    sort: '(joinedAt,asc)'
  });
  if (currentMemberFilter.value) {
    params.append('filter', currentMemberFilter.value);
  }
  return `${baseUrl}/api/dialogs/${dialogId}/members?${params.toString()}`;
}

async function showMembersUrlModal() {
  if (!currentDialogId.value) {
    alert('Ошибка: не выбран диалог');
    return;
  }
  
  const url = generateMembersApiUrl(currentDialogId.value);
  showModal('URL запроса участников', `
    <div class="url-info">
      <h4>Полный URL для копирования:</h4>
      <div class="url-copy">
        <input type="text" id="membersUrlInput" value="${escapeHtml(url)}" readonly onclick="this.select()" style="width: 100%; padding: 8px; font-family: monospace; font-size: 12px;">
        <button onclick="copyToClipboardFromModal('${escapeHtml(url)}')" style="margin-top: 8px; padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; display: block; margin-left: auto; margin-right: 0;">📋 Копировать</button>
      </div>
    </div>
  `);
}

async function showTopicsUrlModal() {
  if (!currentDialogId.value) {
    alert('Сначала выберите диалог');
    return;
  }
  
  if (!currentUserId.value) {
    alert('Сначала выберите пользователя');
    return;
  }
  
  // Строим URL запроса (с контекстом пользователя)
  let url = `/api/users/${currentUserId.value}/dialogs/${currentDialogId.value}/topics`;
  const params = new URLSearchParams();
  
  // Добавляем параметры пагинации
  params.append('page', currentTopicsPage.value.toString());
  params.append('limit', '20');
  
  // Формируем полный URL
  const fullUrl = url + (params.toString() ? '?' + params.toString() : '');
  
  // Получаем правильный базовый URL для tenant-api
  const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
  const fullUrlWithOrigin = `${baseUrl}${fullUrl}`;
  
  // Показываем в модальном окне
  showModal('Текущий URL запроса топиков', `
    <div class="url-info">
      <h4>API Endpoint:</h4>
      <div class="url-display">${escapeHtml(fullUrl)}</div>
      
      <h4>Параметры:</h4>
      <div class="params-list">
        <div><strong>page:</strong> ${currentTopicsPage.value}</div>
        <div><strong>limit:</strong> 20</div>
      </div>
      
      <h4>Полный URL для копирования:</h4>
      <div class="url-copy">
        <input type="text" value="${escapeHtml(fullUrlWithOrigin)}" readonly onclick="this.select()" style="width: 100%; padding: 8px; font-family: monospace; font-size: 12px;">
        <button onclick="copyToClipboardFromModal('${escapeHtml(fullUrlWithOrigin)}')" style="margin-top: 8px; padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; display: block; margin-left: auto; margin-right: 0;">📋 Копировать</button>
      </div>
    </div>
  `);
}

// Инициализация
onMounted(() => {
  if (apiKey.value) {
    loadUsers(1, currentUserLimit.value);
  }
});

// Синхронизация currentUserPageInput с currentUserPage
watch(currentUserPage, (newPage) => {
  currentUserPageInput.value = newPage;
});
</script>

<style scoped>
/* Базовые стили будут добавлены из оригинального HTML */
.user-dialogs-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.container {
  display: flex;
  flex: 1;
  gap: 1px;
  background: #ddd;
  overflow: hidden;
}

.users-panel {
  width: 13%;
  min-width: 370px;
  overflow-y: auto;
  border-right: 1px solid #edeff3;
}

.dialogs-panel {
  width: 30%;
  min-width: 350px;
}

.messages-panel {
  width: 57%;
  min-width: 350px;
}

.panel {
  background: white;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  font-weight: 600;
  color: #495057;
  font-size: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 59px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  font-size: 11px;
}

.pagination-info {
  color: #6c757d;
  font-size: 11px;
  white-space: nowrap;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination button {
  padding: 4px 8px;
  border: 1px solid #ced4da;
  background: white;
  cursor: pointer;
  border-radius: 3px;
  font-size: 11px;
  min-width: 28px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: gray;
}

.pagination button:hover:not(:disabled) {
  background: #e9ecef;
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination button.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.pagination input[type="number"] {
  width: 50px;
  padding: 3px 6px;
  border: 1px solid #ced4da;
  border-radius: 3px;
  font-size: 11px;
  text-align: center;
}

.pagination select {
  padding: 3px 6px;
  border: 1px solid #ced4da;
  border-radius: 3px;
  font-size: 11px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid #e9ecef;
  font-size: 13px;
}

/* Уменьшаем padding для таблицы пользователей, чтобы колонки были уже */
.users-panel table th,
.users-panel table td {
  padding: 4px 8px;
}

th {
  background: #f8f9fa;
  font-weight: 600;
  color: #495057;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
}

th:hover {
  background: #e9ecef;
}

tr:hover {
  background: #f8f9fa;
}

.user-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-info {
  flex: 1;
}

.user-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 2px;
}

.user-id {
  font-size: 12px;
  color: #6c757d;
}

.dialog-row {
  cursor: pointer;
}

.unread-badge {
  background: #dc3545;
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.loading,
.error,
.no-data,
.placeholder {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
}

.error {
  color: #dc3545;
}

.message-content {
  max-width: 100%;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.info-button {
  padding: 4px 6px;
  font-size: 11px;
  border: 1px solid #7c8ff0;
  background: #7c8ff0;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
  max-height: 25px;
  margin-bottom: 1px;
}

.info-button:hover {
  background: #6d7ee0;
  border-color: #6d7ee0;
}

.action-button {
  padding: 4px 5px;
  font-size: 11px;
  border: 1px solid transparent;
  background: #f8f9fa;
  color: #495057;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  margin-right: 1px;
}

.action-button.messages-button {
  background: #9f7aea;
  color: white;
  border-color: #9f7aea;
}

.action-button.messages-button:hover {
  background: #8b6ce8;
  border-color: #8b6ce8;
}

.filter-form {
  padding: 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.form-section {
  margin-bottom: 12px;
}

.form-section label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #495057;
}

.form-section select,
.form-section input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  background: white;
}

.form-section select:focus,
.form-section input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}

.input-with-clear {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-clear input {
  padding-right: 30px;
}

.clear-field {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-field:hover {
  color: #dc3545;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.form-actions button {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
}

.form-actions button:hover {
  background: #e9ecef;
}

.btn-primary {
  background: #667eea !important;
  color: white !important;
  border: none !important;
}

.btn-primary:hover {
  background: #5a6fd8 !important;
}

.form-actions .btn-primary {
  background: #667eea !important;
  color: white !important;
  border: none !important;
}

.form-actions .btn-primary:hover {
  background: #5a6fd8 !important;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.url-button {
  background: #667eea;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: normal;
  transition: background-color 0.2s;
}

.url-button:hover {
  background: #5a6fd8;
}

.view-url-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: normal;
  transition: background-color 0.2s;
}

.view-url-btn:hover {
  background: #5a6fd8;
}

/* Модальные окна */
.modal {
  display: block;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-content {
  background-color: #fefefe;
  margin: 3% auto;
  padding: 0;
  border: none;
  border-radius: 8px;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  background: #f8f9fa;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.close {
  color: #aaa;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  line-height: 1;
}

.close:hover,
.close:focus {
  color: #000;
  text-decoration: none;
}

.modal-body {
  padding: 20px;
  max-height: calc(90vh - 100px);
  overflow-y: auto;
}

.modal-form-container {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.modal-form-left {
  flex: 1;
  min-width: 0;
}

.modal-form-right {
  flex: 1;
  min-width: 0;
  position: sticky;
  top: 0;
  max-height: calc(90vh - 100px);
  overflow-y: auto;
}

.json-content {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: auto;
  margin: 0;
  display: block;
}

.payload-preview {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
}

.payload-json {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  background: white;
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #495057;
}

.form-group select,
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.meta-tag-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
}

.meta-tag-row input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
}

.remove-meta-btn {
  padding: 6px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.remove-meta-btn:hover {
  background: #c82333;
}

.add-meta-btn {
  padding: 6px 12px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 10px;
}

.add-meta-btn:hover {
  background: #218838;
}

.btn-success {
  background: #28a745;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-success:hover {
  background: #218838;
}

.btn-danger {
  background: #dc3545;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-small {
  padding: 4px 5px;
  font-size: 11px;
  border-radius: 3px;
  cursor: pointer;
}

.reaction-item-btn {
  font-size: 24px;
  padding: 8px 16px;
  border: 2px solid #ddd;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.reaction-item-btn.active {
  background: #4fc3f7;
  border-color: #4fc3f7;
  color: white;
  transform: scale(1.1);
}

.reaction-item-btn:hover {
  background: #e9ecef;
}

.reaction-item-btn.active:hover {
  background: #3db3e7;
}

.actions-column {
  padding: 0;
  font-size: 0;
}

.view-column {
  white-space: nowrap;
}

.action-button.topics-button {
  background: #f0f0f0;
  color: #495057;
  border: 1px solid #dee2e6;
}

.action-button.topics-button:hover {
  background: #ffc107;
  color: white;
  border-color: #ffc107;
}

.action-button.members-button {
  background: #63b3ed;
  color: white;
  border-color: #63b3ed;
}

.action-button.members-button:hover {
  background: #4fa3dd;
  border-color: #4fa3dd;
}

.action-button.reactions-button {
  background: #f6ad55;
  color: white;
  border-color: #f6ad55;
}

.action-button.reactions-button:hover {
  background: #f59e42;
  border-color: #f59e42;
}

.action-button.events-button {
  background: #9f7aea;
  color: white;
  border-color: #9f7aea;
}

.action-button.events-button:hover {
  background: #8b6ce8;
  border-color: #8b6ce8;
}

.action-button.status-matrix-button {
  background: #48bb78;
  color: white;
  border-color: #48bb78;
}

.action-button.status-matrix-button:hover {
  background: #38a169;
  border-color: #38a169;
}

.action-button.statuses-button {
  background: #4299e1;
  color: white;
  border-color: #4299e1;
}

.action-button.statuses-button:hover {
  background: #3182ce;
  border-color: #3182ce;
}

.action-button.set-status-button {
  background: #ed8936;
  color: white;
  border-color: #ed8936;
}

.action-button.set-status-button:hover {
  background: #dd6b20;
  border-color: #dd6b20;
}

.width-60 {
  width: 60% !important;
  max-width: 800px;
}

.modal-title-left {
  flex: 1;
}

.modal-title-right {
  flex: 1;
  padding-left: 46px;
}

.meta-list {
  margin-bottom: 20px;
}

.meta-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
}

.meta-section h3 {
  margin-bottom: 15px;
  font-size: 16px;
  color: #495057;
}

.member-meta-empty {
  padding: 20px;
  text-align: center;
  color: #6c757d;
  font-style: italic;
}

.event-row-selected {
  background-color: #e3f2fd !important;
}

.action-button.updates-button {
  background: #48bb78;
  color: white;
  border-color: #48bb78;
}

.action-button.updates-button:hover {
  background: #38a169;
  border-color: #38a169;
}

.status-action-btn:hover {
  opacity: 0.9;
  transform: scale(1.05);
}

.member-meta-editor {
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
  background: #f8f9fa;
  max-height: 260px;
  overflow-y: auto;
}

.member-meta-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.member-meta-row input {
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
}

.member-meta-row .member-meta-key {
  flex: 0 0 180px;
  background: white;
}

.member-meta-row .member-meta-key[readonly] {
  background: #e9ecef;
  cursor: not-allowed;
}

.member-meta-row .member-meta-value {
  flex: 1;
}

.member-meta-empty {
  text-align: center;
  padding: 20px;
  color: #6c757d;
  font-size: 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.meta-editor-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.meta-editor-actions button {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
}

.meta-editor-actions button:hover {
  background: #e9ecef;
}

.meta-editor-actions button.btn-add-tag {
  background: #68d391;
  color: white;
}

.meta-editor-actions button.btn-add-tag:hover {
  background: #5abf7d;
}

.status-message {
  margin-top: 12px;
  font-size: 12px;
}

.status-success {
  color: #28a745;
}

.status-error {
  color: #dc3545;
}

.member-meta-row .member-meta-key[readonly] {
  background: #e9ecef;
  cursor: not-allowed;
}

.member-meta-row .member-meta-value {
  flex: 1;
}

.meta-key-input,
.meta-value-input,
.topic-meta-key-input,
.topic-meta-value-input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.btn-add-meta-tag {
  padding: 6px 12px;
  font-size: 12px;
  line-height: 1;
  height: auto;
  border-radius: 4px;
}

.btn-add-meta-tag:hover {
  background: #218838;
}
</style>

<!-- Глобальные стили для динамического контента в модальном окне (v-html) -->
<style>
/* Стили для кнопок в модальном окне, созданных через v-html */
.modal-body .form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.modal-body .form-actions button {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.modal-body .form-actions .btn-primary {
  background: #667eea !important;
  color: white !important;
  border: none !important;
}

.modal-body .form-actions .btn-primary:hover {
  background: #5a6fd8 !important;
}

.modal-body .form-actions .btn-success {
  background: #48bb78 !important;
  color: white !important;
  border: none !important;
}

.modal-body .form-actions .btn-success:hover {
  background: #38a169 !important;
}

.modal-body .form-actions .btn-secondary {
  background: #6c757d !important;
  color: white !important;
  border: none !important;
}

.modal-body .form-actions .btn-secondary:hover {
  background: #5a6268 !important;
}

/* Стили для JSON контента в модальном окне */
.modal-body .json-content {
  background: #f8f9fa !important;
  border: 1px solid #e9ecef !important;
  border-radius: 4px !important;
  padding: 15px !important;
  font-family: 'Courier New', monospace !important;
  font-size: 12px !important;
  white-space: pre-wrap !important;
  word-wrap: break-word !important;
  overflow-x: auto !important;
  margin: 0 !important;
  display: block !important;
}

.modal-body pre.json-content {
  background: #f8f9fa !important;
  border: 1px solid #e9ecef !important;
  border-radius: 4px !important;
  padding: 15px !important;
  font-family: 'Courier New', monospace !important;
  font-size: 12px !important;
  white-space: pre-wrap !important;
  word-wrap: break-word !important;
  overflow-x: auto !important;
  margin: 0 !important;
}

/* Стили для URL информации в модальном окне */
.modal-body .url-info h4 {
  margin: 15px 0 8px 0;
  color: #333;
  font-size: 14px;
}

.modal-body .url-display {
  background: #f8f9fa !important;
  border: 1px solid #dee2e6 !important;
  border-radius: 4px !important;
  padding: 10px !important;
  font-family: 'Courier New', monospace !important;
  font-size: 12px !important;
  word-break: break-all !important;
  margin-bottom: 10px !important;
}

.modal-body .params-list {
  margin: 10px 0;
}

.modal-body .params-list div {
  margin: 5px 0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.modal-body .url-copy {
  margin-top: 10px;
}

.modal-body .url-copy input {
  background: #f8f9fa !important;
  border: 1px solid #dee2e6 !important;
  border-radius: 4px !important;
  width: 100% !important;
  padding: 8px !important;
  font-family: monospace !important;
  font-size: 12px !important;
}

.modal-body .url-copy button {
  display: block;
  margin-left: auto;
  margin-right: 0;
}

/* Стили для вкладок */
.tabs-container {
  display: flex;
  border-bottom: 2px solid #e9ecef;
  background: #f8f9fa;
  min-height: 59px;
}

.tab-button {
  flex: 1;
  padding: 12px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #6c757d;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-button:hover {
  color: #495057;
  background: #e9ecef;
}

.tab-button.active {
  color: #667eea;
  border-bottom-color: #667eea;
  background: white;
  font-weight: 600;
}
</style>
