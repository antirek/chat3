/**
 * Модуль навигации
 * Отвечает за: переход между страницами, изменение лимита элементов на странице
 */
interface UseNavigationDependencies {
  eventsPagination: {
    goToPage: (page: number) => void;
    setPage: (page: number) => void;
  };
  updatesPagination: {
    goToPage: (page: number) => void;
    setPage: (page: number) => void;
  };
  loadEvents: () => Promise<void>;
  loadUpdates: () => Promise<void>;
}

export function useNavigation(deps: UseNavigationDependencies) {
  const {
    eventsPagination,
    updatesPagination,
    loadEvents,
    loadUpdates,
  } = deps;

  // Перейти на страницу
  function goToPage(type: 'events' | 'updates', page: number) {
    if (type === 'events') {
      eventsPagination.goToPage(page);
      loadEvents();
    } else {
      updatesPagination.goToPage(page);
      loadUpdates();
    }
  }

  // Изменить лимит
  function changeLimit(type: 'events' | 'updates') {
    if (type === 'events') {
      // Лимит уже обновлен через v-model, просто обновляем страницу и загружаем данные
      eventsPagination.setPage(1);
      loadEvents();
    } else {
      // Лимит уже обновлен через v-model, просто обновляем страницу и загружаем данные
      updatesPagination.setPage(1);
      loadUpdates();
    }
  }

  return {
    goToPage,
    changeLimit,
  };
}
