# Руководство по рефакторингу model слоя на FSD

## Текущее состояние

| Файл | Строк | Проблема |
|------|-------|----------|
| `useUserDialogsPage` | ~3000 | Монолит, содержит всё |
| `useDialogsMessagesPage` | ~875 | Смешана логика dialogs + messages |
| `useDbExplorerPage` | ~800 | Календарь, форматтеры |
| `useMessagesPage` | ~600 | CRUD + meta + UI |
| `useUsersPage` | ~650 | CRUD + meta + UI |
| `useTenantsPage` | ~650 | CRUD + meta + UI |
| `useEventsUpdatesPage` | ~437 | Норм |
| `useInitPage` | ~390 | Норм |

---

## Что вынести в `shared/lib/`

### 1. Форматтеры → `shared/lib/formatters.ts`

Дублируется во всех файлах:

```ts
export function formatTimestamp(ts: string | number | undefined): string {
  if (!ts) return '-';
  const timestamp = typeof ts === 'string' ? parseFloat(ts) : ts;
  return new Date(timestamp).toLocaleString('ru-RU');
}

export function escapeHtml(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function shortenId(id: string, prefix: string, visibleChars = 4): string {
  if (!id) return '-';
  if (id.startsWith(prefix)) {
    return `${prefix}${id.substring(prefix.length, prefix.length + visibleChars)}...`;
  }
  return id.length > 20 ? id.substring(0, 20) + '...' : id;
}
```

### 2. Clipboard → `shared/lib/clipboard.ts`

```ts
export async function copyToClipboard(
  text: string,
  onSuccess?: () => void,
  onError?: (err: Error) => void
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    onSuccess?.();
    return true;
  } catch (err) {
    onError?.(err as Error);
    return false;
  }
}

export function useCopyButton(initialText = '📋 Скопировать') {
  const buttonText = ref(initialText);
  
  async function copy(text: string) {
    const success = await copyToClipboard(text);
    buttonText.value = success ? '✅ Скопировано!' : '❌ Ошибка';
    setTimeout(() => { buttonText.value = initialText; }, 2000);
    return success;
  }
  
  return { buttonText, copy };
}
```

### 3. Статусы сообщений → `shared/lib/messageStatus.ts`

```ts
export function getMessageStatus(message: any): string | null {
  if (!message.context?.isMine) return null;
  const statusMatrix = message.statusMessageMatrix || [];
  const readStatus = statusMatrix.find(
    (item: any) => item.userType === 'user' && item.status === 'read' && item.count >= 1
  );
  return readStatus ? 'read' : 'sent';
}

export function getStatusIcon(status: string | null): string {
  const icons: Record<string, string> = {
    sent: '✓', delivered: '✓✓', read: '✓✓', unread: '◯'
  };
  return icons[status || ''] || '?';
}

export function getStatusColor(status: string | null): string {
  const colors: Record<string, string> = {
    sent: '#999', delivered: '#999', read: '#4fc3f7', unread: '#ccc'
  };
  return colors[status || ''] || '#999';
}
```

### 4. URL helpers → `shared/lib/urlHelpers.ts`

```ts
export function getUrlParams(): { apiKey: string; tenantId: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    apiKey: params.get('apiKey') || '',
    tenantId: params.get('tenantId') || 'tnt_default',
  };
}

export function getControlApiUrl(path = ''): string {
  if (typeof window !== 'undefined' && (window as any).CHAT3_CONFIG) {
    return (window as any).CHAT3_CONFIG.getControlApiUrl(path);
  }
  const { protocol, host } = window.location;
  const controlApiUrl = host.includes(':3001') || !host.includes(':')
    ? `${protocol}//${host}`
    : `${protocol}//${host.split(':')[0]}:3002`;
  return `${controlApiUrl}${path}`;
}
```

### 5. Календарь → `shared/lib/composables/useDateRange.ts`

Вынести из `useDbExplorerPage` (~200 строк):
- `calendarDays`, `calendarMonthYear` computed
- `selectDatePreset`, `changeCalendarMonth`
- `getCalendarDayClass`, `selectCalendarDate`
- `getStartOfDay`, `getEndOfDay`, `getDateRange`

---

## Что вынести в `entities/`

### entities/user/model/useUserApi.ts

```ts
export function useUserApi() {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();
  
  async function loadUsers(params: { page: number; limit: number; filter?: string; sort?: object }) { ... }
  async function loadUser(userId: string) { ... }
  async function createUser(data: { userId: string; type?: string }) { ... }
  async function updateUser(userId: string, data: object) { ... }
  async function deleteUser(userId: string) { ... }
  
  return { loadUsers, loadUser, createUser, updateUser, deleteUser };
}
```

### entities/dialog/model/useDialogApi.ts

```ts
export function useDialogApi() {
  async function loadDialogs(params) { ... }
  async function loadUserDialogs(userId: string, page: number) { ... }
  async function loadDialog(dialogId: string) { ... }
  async function createDialog(members: string[]) { ... }
  
  return { loadDialogs, loadUserDialogs, loadDialog, createDialog };
}
```

### entities/message/model/useMessageApi.ts

```ts
export function useMessageApi() {
  async function loadMessages(params) { ... }
  async function loadDialogMessages(dialogId: string, page: number, userId?: string) { ... }
  async function loadMessage(messageId: string) { ... }
  async function addMessage(dialogId: string, payload: object) { ... }
  
  return { loadMessages, loadDialogMessages, loadMessage, addMessage };
}
```

### entities/member/model/useMemberApi.ts

```ts
export function useMemberApi() {
  async function loadDialogMembers(dialogId: string, page: number, filter?: string) { ... }
  async function addMember(dialogId: string, userId: string, type?: string) { ... }
  async function removeMember(dialogId: string, userId: string) { ... }
  
  return { loadDialogMembers, addMember, removeMember };
}
```

### entities/topic/model/useTopicApi.ts

```ts
export function useTopicApi() {
  async function loadDialogTopics(dialogId: string, userId: string, page: number) { ... }
  async function createTopic(dialogId: string, meta?: object) { ... }
  
  return { loadDialogTopics, createTopic };
}
```

### entities/tenant/model/useTenantApi.ts

```ts
export function useTenantApi() {
  async function loadTenants(params) { ... }
  async function loadTenant(tenantId: string) { ... }
  async function createTenant(data: object) { ... }
  async function deleteTenant(tenantId: string) { ... }
  
  return { loadTenants, loadTenant, createTenant, deleteTenant };
}
```

---

## Что вынести в `features/`

### features/meta-editor/model/useMetaEditor.ts

Унифицированная работа с meta для всех сущностей:

```ts
type EntityType = 'user' | 'dialog' | 'message' | 'topic' | 'member' | 'tenant';

export function useMetaEditor(entityType: EntityType) {
  const metaTags = ref<Record<string, any>>({});
  const loading = ref(false);
  const entityId = ref('');
  
  async function loadMeta(id: string) { ... }
  async function setMeta(key: string, value: any) { ... }
  async function deleteMeta(key: string) { ... }
  
  return { metaTags, loading, entityId, loadMeta, setMeta, deleteMeta };
}
```

### features/reactions/model/useReactions.ts

```ts
export function useReactions() {
  const existingReactions = ref<any[]>([]);
  const currentMessageId = ref<string | null>(null);
  
  async function loadReactions(messageId: string, userId: string, dialogId: string) { ... }
  async function toggleReaction(reaction: string) { ... }
  
  return { existingReactions, currentMessageId, loadReactions, toggleReaction };
}
```

### features/message-status/model/useMessageStatusFeature.ts

```ts
export function useMessageStatusFeature() {
  const statusMatrix = ref<any[]>([]);
  const statuses = ref<any[]>([]);
  const loading = ref(false);
  
  async function loadStatusMatrix(messageId: string, userId: string, dialogId: string) { ... }
  async function loadStatuses(messageId: string, page: number) { ... }
  async function setStatus(messageId: string, status: string) { ... }
  
  return { statusMatrix, statuses, loading, loadStatusMatrix, loadStatuses, setStatus };
}
```

### features/events/model/useMessageEvents.ts

```ts
export function useMessageEvents() {
  const events = ref<any[]>([]);
  const eventUpdates = ref<any[]>([]);
  const loading = ref(false);
  
  async function loadEvents(messageId: string, tenantId: string) { ... }
  async function loadEventUpdates(messageId: string, eventId: string) { ... }
  function getEventDescription(eventType: string, data: any): string { ... }
  
  return { events, eventUpdates, loading, loadEvents, loadEventUpdates, getEventDescription };
}
```

### features/events/model/useDialogEvents.ts

```ts
export function useDialogEvents() {
  const dialogEvents = ref<any[]>([]);
  const dialogEventUpdates = ref<any[]>([]);
  const loading = ref(false);
  
  async function loadEvents(dialogId: string, tenantId: string) { ... }
  async function loadUpdates(dialogId: string, eventId: string) { ... }
  
  return { dialogEvents, dialogEventUpdates, loading, loadEvents, loadUpdates };
}
```

---

## Что оставить в `pages/*/model/`

После рефакторинга page composable должен содержать только:

```ts
export function useUserDialogsPage() {
  // 1. Импорт и композиция
  const userApi = useUserApi();
  const dialogApi = useDialogApi();
  const messageApi = useMessageApi();
  const memberApi = useMemberApi();
  const topicApi = useTopicApi();
  const reactions = useReactions();
  const messageStatus = useMessageStatusFeature();
  const messageEvents = useMessageEvents();
  const dialogEvents = useDialogEvents();
  
  // 2. Page-specific state
  const currentUserId = ref<string | null>(null);
  const currentDialogId = ref<string | null>(null);
  const currentViewMode = ref<'messages' | 'members' | 'topics'>('messages');
  
  // 3. Координация между панелями
  async function selectUser(userId: string) {
    currentUserId.value = userId;
    currentDialogId.value = null;
    await dialogApi.loadUserDialogs(userId, 1);
  }
  
  async function selectDialog(dialogId: string) {
    currentDialogId.value = dialogId;
    currentViewMode.value = 'messages';
    await messageApi.loadDialogMessages(dialogId, 1, currentUserId.value);
  }
  
  // 4. onMounted
  onMounted(() => {
    if (credentialsStore.apiKey) {
      userApi.loadUsers({ page: 1, limit: 100 });
    }
  });
  
  // 5. Return всё необходимое для UI
  return {
    // from userApi
    ...userApi,
    // from dialogApi
    ...dialogApi,
    // ... etc
    // page-specific
    currentUserId,
    currentDialogId,
    currentViewMode,
    selectUser,
    selectDialog,
  };
}
```

---

## Приоритет рефакторинга

1. **shared/lib/formatters.ts** — самый простой, много дублирования
2. **shared/lib/clipboard.ts** — тоже много копипаста
3. **entities/** — выделить API-слой для user, dialog, message
4. **features/meta-editor** — унифицировать работу с meta
5. **useUserDialogsPage** — разбить на части после предыдущих шагов

---

## Структура после рефакторинга

```
src/
├── shared/
│   └── lib/
│       ├── formatters.ts
│       ├── clipboard.ts
│       ├── messageStatus.ts
│       ├── urlHelpers.ts
│       └── composables/
│           ├── usePagination.ts    # уже есть
│           ├── useFilter.ts        # уже есть
│           ├── useSort.ts          # уже есть
│           ├── useModal.ts         # уже есть
│           └── useDateRange.ts     # новый
├── entities/
│   ├── user/model/useUserApi.ts
│   ├── dialog/model/useDialogApi.ts
│   ├── message/model/useMessageApi.ts
│   ├── member/model/useMemberApi.ts
│   ├── topic/model/useTopicApi.ts
│   └── tenant/model/useTenantApi.ts
├── features/
│   ├── meta-editor/model/useMetaEditor.ts
│   ├── reactions/model/useReactions.ts
│   ├── message-status/model/useMessageStatusFeature.ts
│   └── events/model/
│       ├── useMessageEvents.ts
│       └── useDialogEvents.ts
└── pages/
    ├── user-dialogs/model/useUserDialogsPage.ts  # ~200-300 строк вместо 3000
    ├── dialogs-messages/model/useDialogsMessagesPage.ts
    ├── messages/model/useMessagesPage.ts
    └── ...
```
