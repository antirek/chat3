<template>
  <div class="user-dialogs-page">
    <div class="container">
      <!-- Пользователи -->
      <BasePanel width="13%" min-width="410px">
        <template #header-left>
          <span>👥 Пользователи</span>
        </template>
        <template #header-right>
          <BaseButton variant="url" @click="showUsersUrl" title="Показать URL запроса">🔗 URL</BaseButton>
        </template>
        <FilterPanel
          input-id="userFilterInput"
          select-id="userFilterExample"
          label="Фильтр"
          :filter-value="userFilterInput"
          :selected-example="selectedUserFilterExample"
          :examples="userFilterExamples"
          placeholder="Например: (userId,regex,carl)&(meta.role,eq,manager)"
          hint="Поля: userId, name, meta.*. Операторы: eq, ne, in, nin, regex, gt, gte, lt, lte. И и ИЛИ: & и |; скобки задают группы (макс. 5 в группе). Пример: (meta.name,eq,a)|(meta.name,eq,b)."
          form-style="border-bottom: 1px solid #e9ecef;"
          @update:filter-value="userFilterInput = $event"
          @update:selected-example="selectedUserFilterExample = $event"
          @select-example="selectUserFilterExample"
          @clear="clearUserFilter"
          @apply="applyUserFilter"
        />
        <ExtendedPagination
          :current-page="currentUserPage"
          :current-page-input="currentUserPageInput"
          :total-pages="totalUserPages"
          :total="totalUsers"
          :pagination-start="userPaginationStart"
          :pagination-end="userPaginationEnd"
          :limit="currentUserLimit"
          @first="goToUsersFirstPage"
          @prev="goToUsersPreviousPage"
          @next="goToUsersNextPage"
          @last="goToUsersLastPage"
          @go-to-page="goToUsersPage"
          @change-limit="changeUserLimit"
        />
        <UsersTable
          :users="users"
          :loading="loadingUsers"
          :error="usersError"
          :selected-user-id="currentUserId"
          @select="selectUser"
          @show-info="showUserInfoModal"
        />
      </BasePanel>

      <!-- Диалоги / Паки пользователя -->
      <BasePanel width="33%" min-width="350px">
        <template #header-left>
          <span>💬 {{ middlePanelTab === 'dialogs' ? 'Диалоги' : 'Паки' }}{{ currentUserName ? ` пользователя ${currentUserName}` : '' }}</span>
        </template>
        <template #header-right>
          <BaseButton
            v-if="middlePanelTab === 'dialogs'"
            id="viewUrlBtn"
            variant="url"
            @click="showCurrentUrl"
            title="Просмотреть текущий URL запроса"
          >
            🔗 URL
          </BaseButton>
          <BaseButton
            v-if="middlePanelTab === 'packs'"
            variant="url"
            @click="showPacksCurrentUrl"
            title="Просмотреть текущий URL запроса паков"
          >
            🔗 URL
          </BaseButton>
        </template>
        <!-- Табы: Диалоги / Паки -->
        <div v-if="currentUserId" class="tabs-container middle-tabs">
          <button
            class="tab-button"
            :class="{ active: middlePanelTab === 'dialogs' }"
            @click="selectMiddlePanelTab('dialogs')"
          >
            💬 Диалоги пользователя
          </button>
          <button
            class="tab-button"
            :class="{ active: middlePanelTab === 'packs' }"
            @click="selectMiddlePanelTab('packs')"
          >
            📦 Паки пользователя
          </button>
        </div>
        <!-- Диалоги: фильтр, пагинация, таблица -->
        <template v-if="middlePanelTab === 'dialogs'">
          <FilterPanel
            v-show="currentUserId"
            input-id="filterValue"
            select-id="filterExample"
            label="Фильтр:"
            :filter-value="filterValue"
            :selected-example="selectedFilterExample"
            :examples="dialogFilterExamples"
            placeholder="Введите или выберите фильтр"
            hint="Поля: dialogId, meta.*. Операторы: eq, ne, in, nin, regex, gt, gte, lt, lte. И и ИЛИ: & и |; скобки задают группы (макс. 5 в группе)."
            @update:filter-value="filterValue = $event"
            @update:selected-example="selectedFilterExample = $event"
            @select-example="selectFilterExample"
            @clear="clearFilter"
            @apply="applyFilter"
          />
          <ExtendedPagination
            v-show="showDialogsPagination"
            :current-page="currentDialogPage"
            :current-page-input="currentDialogPageInput"
            :total-pages="totalDialogPages"
            :total="totalDialogs"
            :pagination-start="dialogPaginationStart"
            :pagination-end="dialogPaginationEnd"
            :limit="currentDialogLimit"
            @first="goToDialogsFirstPage"
            @prev="goToDialogsPreviousPage"
            @next="goToDialogsNextPage"
            @last="goToDialogsLastPage"
            @go-to-page="goToDialogsPage"
            @change-limit="changeDialogLimit"
          />
          <DialogsTable
            :dialogs="dialogs"
            :loading="loadingDialogs"
            :error="dialogsError"
            :selected-dialog-id="currentDialogId"
            :has-user="!!currentUserId"
            :current-sort="currentSort"
            :get-sort-indicator="getDialogSortIndicator"
            @select="selectDialog"
            @show-info="showDialogInfo"
            @show-events="showDialogEventsModal"
            @show-meta="showDialogMetaModal"
            @toggle-sort="toggleSort"
          />
        </template>
        <!-- Паки: фильтр, пагинация, таблица -->
        <template v-if="middlePanelTab === 'packs'">
          <FilterPanel
            v-show="currentUserId"
            input-id="packFilterValue"
            select-id="packFilterExample"
            label="Фильтр:"
            :filter-value="packFilterValue"
            :selected-example="selectedPackFilterExample"
            :examples="packFilterExamples"
            placeholder="Например: (unreadCount,gt,0)"
            hint="Поля: unreadCount, meta.*. Операторы: eq, ne, gt, gte, lt, lte."
            @update:filter-value="packFilterValue = $event"
            @update:selected-example="selectedPackFilterExample = $event"
            @select-example="selectPacksFilterExample"
            @clear="clearPacksFilter"
            @apply="applyPacksFilter"
          />
          <ExtendedPagination
            v-show="currentUserId && totalPacks > 0"
            :current-page="currentPackPage"
            :current-page-input="currentPackPageInput"
            :total-pages="totalPackPages"
            :total="totalPacks"
            :pagination-start="packPaginationStart"
            :pagination-end="packPaginationEnd"
            :limit="currentPackLimit"
            @first="goToPacksFirstPage"
            @prev="goToPacksPreviousPage"
            @next="goToPacksNextPage"
            @last="goToPacksLastPage"
            @go-to-page="goToPacksPage"
            @change-limit="changePackLimit"
          />
          <PacksTable
            :packs="packs"
            :loading="loadingPacks"
            :error="packsError"
            :has-user="!!currentUserId"
            :current-sort="currentPackSort"
            :get-sort-indicator="getPackSortIndicator"
            @show-info="showPackInfo"
            @show-meta="showPackMetaModal"
            @toggle-sort="togglePackSort"
          />
        </template>
      </BasePanel>

      <!-- Сообщения / Участники / Топики -->
      <BasePanel class="messages-panel">
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
        <!-- Кнопки действий под вкладками -->
        <div v-if="currentDialogId" class="actions-row">
          <div class="actions-left">
            <BaseButton
              v-if="currentViewMode === 'messages'"
              variant="success"
              @click="showAddMessageModal"
              title="Добавить сообщение"
              id="addMessageBtn"
            >
              ➕ Добавить
            </BaseButton>
            <BaseButton
              v-if="currentViewMode === 'members'"
              variant="success"
              @click="showAddMemberModal"
              title="Добавить участника"
              id="addMemberBtn"
            >
              ➕ Добавить
            </BaseButton>
            <BaseButton
              v-if="currentViewMode === 'topics'"
              variant="success"
              @click="showAddTopicModal"
              title="Создать топик"
              id="addTopicBtn"
            >
              ➕ Создать
            </BaseButton>
          </div>
          <div class="actions-right">
            <BaseButton
              v-if="currentViewMode === 'messages'"
              variant="url"
              @click="showCurrentMessageUrl"
              title="Показать URL запроса"
              id="messageUrlBtn"
            >
              🔗 URL
            </BaseButton>
            <BaseButton
              v-if="currentViewMode === 'members'"
              variant="url"
              @click="showMembersUrlModal"
              title="Показать URL API"
              id="membersUrlBtn"
            >
              🔗 URL
            </BaseButton>
            <BaseButton
              v-if="currentViewMode === 'topics'"
              variant="url"
              @click="showTopicsUrlModal"
              title="Показать URL API"
              id="topicsUrlBtn"
            >
              🔗 URL
            </BaseButton>
          </div>
        </div>
        <FilterPanel
          v-show="currentDialogId && currentViewMode === 'messages'"
          input-id="messageFilterInput"
          select-id="messageFilterExample"
          label="Фильтр сообщений:"
          :filter-value="messageFilterInput"
          :selected-example="selectedMessageFilterExample"
          :examples="messageFilterExamples"
          placeholder="Введите или выберите фильтр сообщений"
          @update:filter-value="messageFilterInput = $event"
          @update:selected-example="selectedMessageFilterExample = $event"
          @select-example="selectMessageFilterExample"
          @clear="clearMessageFilter"
          @apply="applyMessageFilter"
        />
        <!-- Сообщения -->
        <ExtendedPagination
          v-show="currentViewMode === 'messages' && showMessagesPagination"
          :current-page="currentMessagePage"
          :current-page-input="currentMessagePageInput"
          :total-pages="totalMessagePages"
          :total="totalMessages"
          :pagination-start="messagePaginationStart"
          :pagination-end="messagePaginationEnd"
          :limit="currentMessageLimit"
          container-style="padding: 15px 20px; border-bottom: 1px solid #e9ecef;"
          @first="goToMessagesFirstPage"
          @prev="goToMessagesPreviousPage"
          @next="goToMessagesNextPage"
          @last="goToMessagesLastPage"
          @go-to-page="goToMessagesPage"
          @change-limit="changeMessageLimit"
        />
        <div class="panel-content" id="messagesList" v-show="currentViewMode === 'messages'">
          <MessagesTable
            :messages="messages"
            :loading="loadingMessages"
            :error="messagesError"
            :has-dialog="!!currentDialogId"
            :current-sort="currentMessageSort"
            :get-sort-indicator="getMessageSortIndicator"
            @show-info="showMessageInfo"
            @show-meta="showMessageMetaModal"
            @show-reactions="showReactionModal"
            @show-events="showEventsModal"
            @show-status-matrix="showStatusMatrixModal"
            @show-statuses="showStatusesModal"
            @show-set-status="showSetStatusModal"
            @show-topic="showMessageTopicModal"
            @toggle-sort="toggleMessageSort"
          />
        </div>

        <!-- Топики -->
        <div id="topicsPanelContent" v-show="currentViewMode === 'topics'" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
          <TopicsTable
            :topics="topics"
            :loading="loadingTopics"
            :error="topicsError"
            @show-meta="(topicId) => currentDialogId && showTopicMetaModal(currentDialogId, topicId)"
            @show-messages-for-topic="showMessagesForTopic"
          />
          <ExtendedPagination
            v-if="totalTopicsPages > 1"
            :current-page="currentTopicsPage"
            :current-page-input="currentTopicsPageInput"
            :total-pages="totalTopicsPages"
            :total="totalTopics"
            :pagination-start="topicsPaginationStart"
            :pagination-end="topicsPaginationEnd"
            :limit="currentTopicsLimit"
            container-style="margin-top: 15px; padding: 0 20px;"
            @first="goToTopicsFirstPage"
            @prev="goToTopicsPreviousPage"
            @next="goToTopicsNextPage"
            @last="goToTopicsLastPage"
            @go-to-page="goToTopicsPage"
            @change-limit="changeTopicsLimit"
          />
        </div>

        <!-- Участники -->
        <div id="membersPanelContent" v-show="currentViewMode === 'members'" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
          
          <div id="membersListSectionPanel" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
            <FilterPanel
              input-id="memberFilterInputPanel"
              select-id="memberFilterExamplePanel"
              label="Фильтр участников (формат: (поле,оператор,значение))"
              :filter-value="memberFilterInput"
              :selected-example="selectedMemberFilterExample"
              :examples="memberFilterExamples"
              placeholder="Например: (userId,regex,carl)&(meta.role,eq,agent)"
              hint="Поля: userId, isActive, unreadCount, joinedAt, meta.*. Операторы: eq, ne, in, nin, regex, gt, gte, lt, lte. И и ИЛИ: & и |; скобки задают группы (макс. 5 в группе)."
              form-style="border-bottom: 1px solid #e9ecef; padding: 15px 20px;"
              @update:filter-value="memberFilterInput = $event"
              @update:selected-example="selectedMemberFilterExample = $event"
              @select-example="selectMemberFilterExamplePanel"
              @clear="clearMemberFilterFieldPanel"
              @apply="applyMemberFilterPanel"
            />
            
            <!-- Пагинация участников -->
            <ExtendedPagination
              v-show="totalMembers > 0"
              :current-page="currentMemberPage"
              :current-page-input="currentMemberPageInput"
              :total-pages="totalMemberPages"
              :total="totalMembers"
              :pagination-start="memberPaginationStart"
              :pagination-end="memberPaginationEnd"
              :limit="currentMemberLimit"
              container-style="padding: 15px 20px; border-bottom: 1px solid #e9ecef;"
              @first="goToMembersFirstPage"
              @prev="goToMembersPreviousPage"
              @next="goToMembersNextPage"
              @last="goToMembersLastPage"
              @go-to-page="goToMembersPage"
              @change-limit="changeMemberLimit"
            />
            
            <!-- Таблица участников -->
            <MembersTable
              :members="members"
              :loading="loadingMembers"
              :error="membersError"
              @show-meta="(userId) => currentDialogId && showMemberMetaModal(currentDialogId, userId)"
              @remove="(userId) => currentDialogId && removeMemberFromPanel(currentDialogId, userId)"
            />
          </div>
        </div>
      </BasePanel>
    </div>

    <!-- Модальное окно для информации -->
    <InfoModal
      :is-open="isInfoModalOpen"
      :title="modalTitle"
      :url="modalUrl"
      :json-content="modalJsonContent"
      :other-content="modalOtherContent"
      @close="closeModal"
    />

    <!-- Модальное окно для добавления сообщения -->
    <AddMessageModal
      :is-open="isAddMessageModalOpen"
      :current-dialog-id="currentDialogId"
      v-model:sender="messageSender"
      v-model:type="messageType"
      v-model:topic-id="messageTopicId"
      v-model:content="messageContent"
      v-model:quoted-message-id="quotedMessageId"
      v-model:meta-tags="messageMetaTags"
      :available-topics="availableTopics"
      @close="closeAddMessageModal"
      @add-meta-tag="addMetaTagRow"
      @remove-meta-tag="removeMetaTagRow"
      @submit="submitAddMessage"
    />

    <!-- Модальное окно для добавления реакции -->
    <ReactionModal
      :is-open="isReactionModalOpen"
      :existing-reactions="existingReactions"
      @close="closeReactionModal"
      @toggle-reaction="toggleReaction"
    />

    <!-- Модальное окно для просмотра событий сообщения -->
    <EventsModal
      :is-open="isEventsModalOpen"
      :events="events"
      :event-updates="eventUpdates"
      :loading="loadingEvents"
      :error="eventsError"
      :get-event-id="getEventId"
      :get-event-description="getEventDescription"
      :format-event-time="formatEventTime"
      @close="closeEventsModal"
      @load-updates="loadEventUpdates"
    />

    <!-- Модальное окно для просмотра событий диалога -->
    <DialogEventsModal
      :is-open="isDialogEventsModalOpen"
      :events="dialogEvents"
      :dialog-event-updates="dialogEventUpdates"
      :loading="loadingDialogEvents"
      :error="dialogEventsError"
      :dialog-id="currentDialogIdForEvents"
      :selected-event-id="selectedDialogEventId"
      :get-dialog-event-id="getDialogEventId"
      :get-dialog-event-description="getDialogEventDescription"
      :format-event-time="formatEventTime"
      :get-update-id="getUpdateId"
      @close="closeDialogEventsModal"
      @load-updates="loadAllDialogUpdatesInModal"
    />

    <!-- Модальное окно для просмотра матрицы статусов сообщения -->
    <StatusMatrixModal
      :is-open="isStatusMatrixModalOpen"
      :status-matrix="statusMatrix"
      :loading="loadingStatusMatrix"
      :error="statusMatrixError"
      :url="statusMatrixUrl"
      @close="closeStatusMatrixModal"
    />

    <!-- Модальное окно для просмотра статусов сообщения -->
    <StatusesModal
      :is-open="isStatusesModalOpen"
      :statuses="statuses"
      :loading="loadingStatuses"
      :error="statusesError"
      :url="statusesUrl"
      :total="totalStatuses"
      :current-page="currentStatusesPage"
      :total-pages="totalStatusesPages"
      :format-event-time="formatEventTime"
      @close="closeStatusesModal"
      @go-to-page="goToStatusesPage"
    />

    <!-- Модальное окно мета-тегов диалога -->
    <MetaModal
      :is-open="isDialogMetaModalOpen"
      title="🏷️ Meta теги диалога"
      :loading="loadingDialogMeta"
      :meta-tags="dialogMetaTags"
      key-placeholder="key (например: type)"
      value-placeholder='value (прим: "internal", ["foo", "bar"], {"foo": "bar"}, 5, false)'
      @close="closeDialogMetaModal"
      @add-tag="(key, value) => addDialogMetaTag(key, value)"
      @delete-tag="deleteDialogMetaTag"
    />

    <!-- Модальное окно для установки статуса сообщения -->
    <SetStatusModal
      :is-open="isSetStatusModalOpen"
      :url="setStatusUrl"
      :result="setStatusResult"
      @close="closeSetStatusModal"
      @set-status="setMessageStatus"
    />

    <!-- Модальное окно топика сообщения (установить/сбросить) -->
    <MessageTopicModal
      :is-open="isMessageTopicModalOpen"
      :message-id="currentMessageForTopic?.messageId ?? null"
      :current-topic-id="currentMessageForTopic?.topicId ?? null"
      :dialog-topics="dialogTopicsForMessageTopic"
      :loading="loadingMessageTopic"
      :error="errorMessageTopic"
      @close="closeMessageTopicModal"
      @clear="clearMessageTopic"
      @set="setMessageTopic"
    />

    <!-- Модальное окно мета-тегов сообщения -->
    <MetaModal
      :is-open="isMessageMetaModalOpen"
      title="🏷️ Meta теги сообщения"
      :loading="loadingMessageMeta"
      :meta-tags="messageMetaTagsData"
      key-placeholder="key (например: channelType)"
      value-placeholder='value (например: "whatsapp" или {"foo": "bar"})'
      @close="closeMessageMetaModal"
      @add-tag="(key, value) => addMessageMetaTag(key, value)"
      @delete-tag="deleteMessageMetaTag"
    />

    <!-- Модальное окно для добавления участника -->
    <AddMemberModal
      :is-open="isAddMemberModalOpen"
      :available-users="availableUsersForMember"
      :selected-user="newMemberSelect"
      :member-type="newMemberType"
      :meta-tags="newMemberMetaTags"
      @close="closeAddMemberModal"
      @submit="submitAddMember"
      @update:selected-user="newMemberSelect = $event"
      @update:member-type="newMemberType = $event"
      @add-meta-row="addMemberMetaRow"
      @remove-meta-row="removeMemberMetaRow"
      @update-meta-key="(i, v) => newMemberMetaTags[i].key = v"
      @update-meta-value="(i, v) => newMemberMetaTags[i].value = v"
    />

    <!-- Модальное окно для редактирования мета-тегов участника -->
    <MemberMetaModal
      :is-open="isMemberMetaModalOpen"
      :dialog-id="memberMetaModalDialogId"
      :user-id="memberMetaModalUserId"
      :meta-tags="memberMetaTags"
      :status="memberMetaStatus"
      @close="closeMemberMetaModal"
      @save="saveMemberMetaChangesModal"
      @add-meta-row-with-data="(key, value) => addMemberMetaRowModal(key, value)"
      @remove-meta-row="removeMemberMetaRowModal"
      @update-meta-key="(i, v) => updateMemberMetaKeyModal(i, v)"
      @update-meta-value="(i, v) => updateMemberMetaValueModal(i, v)"
    />

    <!-- Модальное окно для создания топика -->
    <AddTopicModal
      :is-open="isAddTopicModalOpen"
      :meta-tags="newTopicMetaTags"
      @close="closeAddTopicModal"
      @submit="submitAddTopic"
      @add-meta-row="addTopicMetaRow"
      @remove-meta-row="removeTopicMetaRow"
      @update-meta-key="(i, v) => newTopicMetaTags[i].key = v"
      @update-meta-value="(i, v) => newTopicMetaTags[i].value = v"
    />

    <!-- Модальное окно для мета-тегов топика -->
    <TopicMetaModal
      :is-open="isTopicMetaModalOpen"
      :meta-tags="topicMetaTags"
      :loading="loadingTopicMeta"
      @close="closeTopicMetaModal"
      @delete-tag="deleteTopicMetaTag"
      @add-tag="(key, value) => addTopicMetaTag(key, value)"
    />

    <!-- Модальное окно мета-тегов пака -->
    <MetaModal
      :is-open="isPackMetaModalOpen"
      title="🏷️ Meta теги пака"
      :loading="loadingPackMeta"
      :meta-tags="packMetaTags"
      key-placeholder="key (например: name)"
      value-placeholder='value (например: "Support Pack")'
      @close="closePackMetaModal"
      @add-tag="(key, value) => addPackMetaTag(key, value)"
      @delete-tag="deletePackMetaTag"
    />

    <UrlModal
      :is-open="isUrlModalOpen"
      :title="urlModalTitle"
      :url="urlModalUrl"
      :copy-button-text="urlCopyButtonText"
      @close="closeUrlModal"
      @copy="copyUrlToClipboard"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { BasePanel, BaseButton } from '@/shared/ui';
import { useUserDialogsPage } from '../model';
import {
  InfoModal,
  AddMessageModal,
  ReactionModal,
  MetaModal,
  SetStatusModal,
  MessageTopicModal,
  EventsModal,
  DialogEventsModal,
  StatusMatrixModal,
  StatusesModal,
  AddMemberModal,
  MemberMetaModal,
  AddTopicModal,
  TopicMetaModal,
  UrlModal,
} from './modals';
import {
  FilterPanel,
  userFilterExamples,
  dialogFilterExamples,
  messageFilterExamples,
  memberFilterExamples,
  packFilterExamples,
} from './filters';
import { ExtendedPagination } from './pagination';
import { UsersTable, DialogsTable, PacksTable, MessagesTable, TopicsTable, MembersTable } from './tables';

// Используем composable
const pageData = useUserDialogsPage();

// Деструктурируем только то, что нужно в template
const {
  // Users
  loadingUsers,
  usersError,
  users,
  currentUserId,
  currentUserName,
  userPaginationStart,
  userPaginationEnd,
  // Users Pagination
  currentUserPage,
  currentUserPageInput,
  currentUserLimit,
  totalUserPages,
  totalUsers,
  // Users Filter
  userFilterInput,
  selectedUserFilterExample,
  // Dialogs
  loadingDialogs,
  dialogsError,
  dialogs,
  currentDialogId,
  showDialogsPagination,
  // Dialogs Pagination
  currentDialogPage,
  currentDialogPageInput,
  currentDialogLimit,
  totalDialogPages,
  totalDialogs,
  dialogPaginationStart,
  dialogPaginationEnd,
  // Dialogs Filter
  filterValue,
  selectedFilterExample,
  // Dialogs Sort
  currentSort,
  toggleSort,
  getDialogSortIndicator,
  // Middle panel tab and Packs
  middlePanelTab,
  selectMiddlePanelTab,
  loadingPacks,
  packsError,
  packs,
  packFilterValue,
  selectedPackFilterExample,
  currentPackPage,
  currentPackPageInput,
  currentPackLimit,
  totalPackPages,
  totalPacks,
  packPaginationStart,
  packPaginationEnd,
  currentPackSort,
  togglePackSort,
  getPackSortIndicator,
  selectPacksFilterExample,
  clearPacksFilter,
  applyPacksFilter,
  changePackPage,
  showPacksCurrentUrl,
  showPackInfo,
  goToPacksFirstPage,
  goToPacksPreviousPage,
  goToPacksNextPage,
  goToPacksLastPage,
  goToPacksPage,
  changePackLimit,
  showPackMetaModal,
  closePackMetaModal,
  packMetaTags,
  loadingPackMeta,
  newPackMetaKey,
  newPackMetaValue,
  addPackMetaTag,
  deletePackMetaTag,
  isPackMetaModalOpen,
  // Messages
  loadingMessages,
  messagesError,
  messages,
  showMessagesPagination,
  // Messages Pagination
  currentMessagePage,
  currentMessagePageInput,
  currentMessageLimit,
  totalMessagePages,
  totalMessages,
  messagePaginationStart,
  messagePaginationEnd,
  // Messages Filter
  messageFilterInput,
  selectedMessageFilterExample,
  // Messages Sort
  currentMessageSort,
  toggleMessageSort,
  getMessageSortIndicator,
  // Members
  loadingMembers,
  membersError,
  members,
  // Members Pagination
  currentMemberPage,
  currentMemberPageInput,
  currentMemberLimit,
  totalMemberPages,
  totalMembers,
  memberPaginationStart,
  memberPaginationEnd,
  // Members Filter
  memberFilterInput,
  selectedMemberFilterExample,
  // Topics
  loadingTopics,
  topicsError,
  topics,
  // Topics Pagination
  currentTopicsPage,
  currentTopicsPageInput,
  currentTopicsLimit,
  totalTopicsPages,
  totalTopics,
  topicsPaginationStart,
  topicsPaginationEnd,
  // View Mode
  currentViewMode,
  // Modals - flags
  isInfoModalOpen,
  isAddMessageModalOpen,
  isReactionModalOpen,
  isEventsModalOpen,
  isStatusMatrixModalOpen,
  isStatusesModalOpen,
  isSetStatusModalOpen,
  isMessageTopicModalOpen,
  isDialogEventsModalOpen,
  isDialogMetaModalOpen,
  isAddMemberModalOpen,
  isAddTopicModalOpen,
  isMemberMetaModalOpen,
  isMessageMetaModalOpen,
  isTopicMetaModalOpen,
  modalTitle,
  modalUrl,
  modalJsonContent,
  modalOtherContent,
  // Functions
  loadUsers,
  selectUserFilterExample,
  clearUserFilter,
  applyUserFilter,
  goToUsersFirstPage,
  goToUsersPreviousPage,
  goToUsersNextPage,
  goToUsersLastPage,
  goToUsersPage,
  changeUserLimit,
  selectUser,
  selectFilterExample,
  clearFilter,
  applyFilter,
  // Dialogs Pagination Functions
  goToDialogsFirstPage,
  goToDialogsPreviousPage,
  goToDialogsNextPage,
  goToDialogsLastPage,
  goToDialogsPage,
  changeDialogLimit,
  selectDialog,
  selectDialogMembers,
  selectDialogTopics,
  showMessagesForTopic,
  selectMessageFilterExample,
  clearMessageFilter,
  applyMessageFilter,
  // Messages Pagination Functions
  goToMessagesFirstPage,
  goToMessagesPreviousPage,
  goToMessagesNextPage,
  goToMessagesLastPage,
  goToMessagesPage,
  changeMessageLimit,
  selectMemberFilterExamplePanel,
  clearMemberFilterFieldPanel,
  applyMemberFilterPanel,
  // Members Pagination Functions
  goToMembersFirstPage,
  goToMembersPreviousPage,
  goToMembersNextPage,
  goToMembersLastPage,
  goToMembersPage,
  changeMemberLimit,
  // Topics Pagination Functions
  goToTopicsFirstPage,
  goToTopicsPreviousPage,
  goToTopicsNextPage,
  goToTopicsLastPage,
  goToTopicsPage,
  changeTopicsLimit,
  closeModal,
  showUsersUrl,
  showCurrentUrl,
  showCurrentMessageUrl,
  showDialogInfo,
  showMessageInfo,
  showUserInfoModal,
  // Добавление сообщения
  showAddMessageModal,
  closeAddMessageModal,
  addMetaTagRow,
  removeMetaTagRow,
  submitAddMessage,
  messageSender,
  messageType,
  messageContent,
  messageTopicId,
  quotedMessageId,
  messageMetaTags,
  availableTopics,
  // Реакции
  showReactionModal,
  closeReactionModal,
  toggleReaction,
  existingReactions,
  // События сообщения
  showEventsModal,
  closeEventsModal,
  getEventId,
  formatEventTime,
  getEventDescription,
  loadEventUpdates,
  events,
  loadingEvents,
  eventsError,
  eventUpdates,
  // Статусы
  showStatusMatrixModal,
  closeStatusMatrixModal,
  showStatusesModal,
  closeStatusesModal,
  goToStatusesPage,
  showSetStatusModal,
  closeSetStatusModal,
  setMessageStatus,
  showMessageTopicModal,
  closeMessageTopicModal,
  currentMessageForTopic,
  dialogTopicsForMessageTopic,
  loadingMessageTopic,
  errorMessageTopic,
  setMessageTopic,
  clearMessageTopic,
  setStatusResult,
  setStatusUrl,
  loadingStatusMatrix,
  statusMatrixError,
  loadingStatuses,
  statusesError,
  statusesUrl,
  statusMatrixUrl,
  totalStatuses,
  statusMatrix,
  statuses,
  currentStatusesPage,
  totalStatusesPages,
  // События диалога
  showDialogEventsModal,
  closeDialogEventsModal,
  getDialogEventId,
  getUpdateId,
  getDialogEventDescription,
  loadAllDialogUpdatesInModal,
  currentDialogIdForEvents,
  dialogEvents,
  loadingDialogEvents,
  dialogEventsError,
  selectedDialogEventId,
  dialogEventUpdates,
  // Мета-теги диалога
  showDialogMetaModal,
  closeDialogMetaModal,
  addDialogMetaTag,
  deleteDialogMetaTag,
  dialogMetaTags,
  loadingDialogMeta,
  newDialogMetaKey,
  newDialogMetaValue,
  // Добавление участника
  showAddMemberModal,
  closeAddMemberModal,
  addMemberMetaRow,
  removeMemberMetaRow,
  submitAddMember,
  newMemberSelect,
  newMemberType,
  newMemberMetaTags,
  availableUsersForMember,
  // Создание топика
  showAddTopicModal,
  closeAddTopicModal,
  addTopicMetaRow,
  removeTopicMetaRow,
  submitAddTopic,
  newTopicMetaTags,
  // Мета-теги участника
  showMemberMetaModal,
  closeMemberMetaModal,
  addMemberMetaRowModal,
  updateMemberMetaKeyModal,
  updateMemberMetaValueModal,
  removeMemberMetaRowModal,
  saveMemberMetaChangesModal,
  memberMetaModalDialogId,
  memberMetaModalUserId,
  memberMetaTags,
  memberMetaStatus,
  // Мета-теги сообщения
  showMessageMetaModal,
  closeMessageMetaModal,
  addMessageMetaTag,
  deleteMessageMetaTag,
  messageMetaTagsData,
  loadingMessageMeta,
  newMessageMetaKey,
  newMessageMetaValue,
  // Мета-теги топика
  showTopicMetaModal,
  closeTopicMetaModal,
  addTopicMetaTag,
  deleteTopicMetaTag,
  topicMetaTags,
  loadingTopicMeta,
  // Участники
  removeMemberFromPanel,
  showMembersUrlModal,
  showTopicsUrlModal,
  // URL модалка
  isUrlModalOpen,
  showUrlModal,
  urlModalTitle,
  urlModalUrl,
  urlCopyButtonText,
  closeUrlModal,
  copyUrlToClipboard,
} = pageData;

// Инициализация
onMounted(() => {
  // loadUsers проверяет apiKey внутри себя
  loadUsers();
});
</script>

<style scoped>
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

.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  min-height: 0;
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

.actions-row {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 59px;
  flex-shrink: 0;
}

.actions-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.actions-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
