import { Ref } from 'vue';
import { useModal } from '@/shared/lib/composables/useModal';
import { useCredentialsStore } from '@/app/stores/credentials';
import { getUrlParams as getUrlParamsFromLib, getTenantApiUrl } from '@/shared/lib/utils/url';

export function useTopicsMessagesUtils(
  urlModalUrl: Ref<string>,
  urlCopyButtonText: Ref<string>,
  modalTitle: Ref<string>,
  modalUrl: Ref<string | null>,
  modalJsonContent: Ref<string | null>,
  modalOtherContent: Ref<string | null>,
  infoModal: ReturnType<typeof useModal>,
  credentialsStore: ReturnType<typeof useCredentialsStore>,
  apiKey: Ref<string>,
  loadTopics: (page?: number) => Promise<void>,
) {
  function copyUrlToClipboard() {
    navigator.clipboard.writeText(urlModalUrl.value).then(
      () => {
        urlCopyButtonText.value = '✅ Скопировано!';
        setTimeout(() => {
          urlCopyButtonText.value = '📋 Скопировать URL';
        }, 2000);
      },
      () => {
        urlCopyButtonText.value = '❌ Ошибка';
        setTimeout(() => {
          urlCopyButtonText.value = '📋 Скопировать URL';
        }, 2000);
      },
    );
  }

  function showTopicInfoModal(topic: Record<string, unknown> & { dialogId?: string; topicId?: string }) {
    modalTitle.value = 'Топик';
    const dialogId = topic.dialogId;
    const topicId = topic.topicId;
    modalUrl.value =
      dialogId && topicId ? getTenantApiUrl(`/api/dialogs/${dialogId}/topics/${topicId}`) : null;
    modalJsonContent.value = JSON.stringify(topic, null, 2);
    modalOtherContent.value = null;
    infoModal.open();
  }

  function getUrlParams() {
    return getUrlParamsFromLib();
  }

  function setApiKeyFromExternal(apiKeyVal: string, tenantId?: string) {
    credentialsStore.setApiKey(apiKeyVal);
    if (tenantId) credentialsStore.setTenantId(tenantId);
    loadTopics(1);
  }

  return {
    copyUrlToClipboard,
    showTopicInfoModal,
    closeModal: infoModal.close,
    getUrlParams,
    setApiKeyFromExternal,
  };
}
