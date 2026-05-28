import { ref, onMounted, onUnmounted } from 'vue';

export interface UseModalOptions {
  onClose?: () => void;
  onOpen?: () => void;
}

export function useModal(options: UseModalOptions = {}) {
  const { onClose, onOpen } = options;
  const isOpen = ref(false);

  function open() {
    isOpen.value = true;
    if (onOpen) {
      onOpen();
    }
  }

  function close() {
    isOpen.value = false;
    if (onClose) {
      onClose();
    }
  }

  function toggle() {
    if (isOpen.value) {
      close();
    } else {
      open();
    }
  }

  // Закрытие по Esc
  function handleEscape(event: { key?: string }) {
    if (event.key === 'Escape' || event.key === 'Esc') {
      close();
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleEscape);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleEscape);
  });

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}
