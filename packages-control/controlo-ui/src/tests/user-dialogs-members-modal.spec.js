import { test, expect } from '@playwright/test';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';
const API_KEY = process.env.API_KEY || 'chat3_91b81eff6a450427e9e8f7e9bcd8431e02982871623301321890736ab97d55d7';
const TENANT_ID = process.env.TENANT_ID || 'tnt_default';

test.describe('User Dialogs - Members Modal Interface', () => {
  test.beforeEach(async ({ page }) => {
    // Открываем страницу с API ключом и tenant ID
    await page.goto(`${GATEWAY_URL}/api-test-user-dialogs.html?apiKey=${API_KEY}&tenantId=${TENANT_ID}`);
    
    // Ждем загрузки страницы
    await page.waitForLoadState('networkidle');
    
    // Ждем появления таблицы пользователей
    await page.waitForSelector('table', { timeout: 10000 });
  });

  test('should not have "Добавить участника" form in members section', async ({ page }) => {
    // Выбираем первого пользователя
    const firstUserRow = page.locator('table tbody tr').first();
    await firstUserRow.click();
    
    // Ждем загрузки диалогов
    await page.waitForSelector('.dialogs-panel table tbody tr', { timeout: 10000 });
    
    // Выбираем первый диалог для просмотра участников
    const firstDialogRow = page.locator('.dialogs-panel table tbody tr').first();
    const participantsButton = firstDialogRow.locator('button:has-text("👥 Участники")');
    await participantsButton.click();
    
    // Ждем появления панели участников
    await page.waitForSelector('#membersPanelContent', { timeout: 5000 });
    
    // Проверяем, что форма "Добавить участника" отсутствует
    const addMemberForm = page.locator('#addMemberFormPanel');
    await expect(addMemberForm).not.toBeVisible();
    
    // Проверяем, что нет секции "Добавить участника:"
    const addMemberSection = page.locator('text=Добавить участника:');
    await expect(addMemberSection).not.toBeVisible();
  });

  test('should not have "Мета" tab in members section', async ({ page }) => {
    // Выбираем первого пользователя
    const firstUserRow = page.locator('table tbody tr').first();
    await firstUserRow.click();
    
    // Ждем загрузки диалогов
    await page.waitForSelector('.dialogs-panel table tbody tr', { timeout: 10000 });
    
    // Выбираем первый диалог для просмотра участников
    const firstDialogRow = page.locator('.dialogs-panel table tbody tr').first();
    const participantsButton = firstDialogRow.locator('button:has-text("👥 Участники")');
    await participantsButton.click();
    
    // Ждем появления панели участников
    await page.waitForSelector('#membersPanelContent', { timeout: 5000 });
    
    // Проверяем, что вкладка "Мета" отсутствует
    const metaTab = page.locator('#membersTabMetaPanel');
    await expect(metaTab).not.toBeVisible();
    
    // Проверяем, что нет секции редактирования мета-тегов
    const metaSection = page.locator('#memberMetaSectionPanel');
    await expect(metaSection).not.toBeVisible();
  });

  test('should have "➕ Добавить" button in members header', async ({ page }) => {
    // Выбираем первого пользователя
    const firstUserRow = page.locator('table tbody tr').first();
    await firstUserRow.click();
    
    // Ждем загрузки диалогов
    await page.waitForSelector('.dialogs-panel table tbody tr', { timeout: 10000 });
    
    // Выбираем первый диалог для просмотра участников
    const firstDialogRow = page.locator('.dialogs-panel table tbody tr').first();
    const participantsButton = firstDialogRow.locator('button:has-text("👥 Участники")');
    await participantsButton.click();
    
    // Ждем появления панели участников
    await page.waitForSelector('#membersPanelContent', { timeout: 5000 });
    
    // Проверяем, что кнопка "➕ Добавить" видна в заголовке
    const addButton = page.locator('#addMemberBtn:has-text("➕ Добавить")');
    await expect(addButton).toBeVisible();
  });

  test('should have "🏷️ Мета" button in members table actions column', async ({ page }) => {
    // Выбираем первого пользователя
    const firstUserRow = page.locator('table tbody tr').first();
    await firstUserRow.click();
    
    // Ждем загрузки диалогов
    await page.waitForSelector('.dialogs-panel table tbody tr', { timeout: 10000 });
    
    // Выбираем первый диалог для просмотра участников
    const firstDialogRow = page.locator('.dialogs-panel table tbody tr').first();
    const participantsButton = firstDialogRow.locator('button:has-text("👥 Участники")');
    await participantsButton.click();
    
    // Ждем появления панели участников и таблицы участников
    await page.waitForSelector('#currentMembersListPanel table tbody tr', { timeout: 10000 });
    
    // Проверяем, что в таблице участников есть кнопка "🏷️ Мета" в колонке "Действия"
    const metaButton = page.locator('#currentMembersListPanel button:has-text("🏷️ Мета")').first();
    await expect(metaButton).toBeVisible();
  });

  test('should open "Добавить участника" modal when clicking "➕ Добавить" button', async ({ page }) => {
    // Выбираем первого пользователя
    const firstUserRow = page.locator('table tbody tr').first();
    await firstUserRow.click();
    
    // Ждем загрузки диалогов
    await page.waitForSelector('.dialogs-panel table tbody tr', { timeout: 10000 });
    
    // Выбираем первый диалог для просмотра участников
    const firstDialogRow = page.locator('.dialogs-panel table tbody tr').first();
    const participantsButton = firstDialogRow.locator('button:has-text("👥 Участники")');
    await participantsButton.click();
    
    // Ждем появления панели участников
    await page.waitForSelector('#membersPanelContent', { timeout: 5000 });
    
    // Нажимаем кнопку "➕ Добавить"
    const addButton = page.locator('#addMemberBtn:has-text("➕ Добавить")');
    await addButton.click();
    
    // Проверяем, что модальное окно открылось
    const modal = page.locator('#addMemberModal');
    await expect(modal).toBeVisible();
    
    // Проверяем заголовок модального окна
    const modalTitle = modal.locator('.modal-title:has-text("Добавить участника")');
    await expect(modalTitle).toBeVisible();
    
    // Проверяем наличие формы в модальном окне
    const form = modal.locator('#addMemberFormModal');
    await expect(form).toBeVisible();
    
    // Проверяем наличие select для выбора пользователя
    const userSelect = form.locator('#newMemberSelectModal');
    await expect(userSelect).toBeVisible();
  });

  test('should close "Добавить участника" modal when clicking close button', async ({ page }) => {
    // Выбираем первого пользователя
    const firstUserRow = page.locator('table tbody tr').first();
    await firstUserRow.click();
    
    // Ждем загрузки диалогов
    await page.waitForSelector('.dialogs-panel table tbody tr', { timeout: 10000 });
    
    // Выбираем первый диалог для просмотра участников
    const firstDialogRow = page.locator('.dialogs-panel table tbody tr').first();
    const participantsButton = firstDialogRow.locator('button:has-text("👥 Участники")');
    await participantsButton.click();
    
    // Ждем появления панели участников
    await page.waitForSelector('#membersPanelContent', { timeout: 5000 });
    
    // Открываем модальное окно
    const addButton = page.locator('#addMemberBtn:has-text("➕ Добавить")');
    await addButton.click();
    
    // Проверяем, что модальное окно открылось
    const modal = page.locator('#addMemberModal');
    await expect(modal).toBeVisible();
    
    // Нажимаем кнопку закрытия
    const closeButton = modal.locator('.close');
    await closeButton.click();
    
    // Проверяем, что модальное окно закрылось
    await expect(modal).not.toBeVisible();
  });

  test('should close "Добавить участника" modal when pressing Escape key', async ({ page }) => {
    // Выбираем первого пользователя
    const firstUserRow = page.locator('table tbody tr').first();
    await firstUserRow.click();
    
    // Ждем загрузки диалогов
    await page.waitForSelector('.dialogs-panel table tbody tr', { timeout: 10000 });
    
    // Выбираем первый диалог для просмотра участников
    const firstDialogRow = page.locator('.dialogs-panel table tbody tr').first();
    const participantsButton = firstDialogRow.locator('button:has-text("👥 Участники")');
    await participantsButton.click();
    
    // Ждем появления панели участников
    await page.waitForSelector('#membersPanelContent', { timeout: 5000 });
    
    // Открываем модальное окно
    const addButton = page.locator('#addMemberBtn:has-text("➕ Добавить")');
    await addButton.click();
    
    // Проверяем, что модальное окно открылось
    const modal = page.locator('#addMemberModal');
    await expect(modal).toBeVisible();
    
    // Нажимаем Escape
    await page.keyboard.press('Escape');
    
    // Проверяем, что модальное окно закрылось
    await expect(modal).not.toBeVisible();
  });

  test('should open "Мета-теги участника" modal when clicking "🏷️ Мета" button', async ({ page }) => {
    // Выбираем первого пользователя
    const firstUserRow = page.locator('table tbody tr').first();
    await firstUserRow.click();
    
    // Ждем загрузки диалогов
    await page.waitForSelector('.dialogs-panel table tbody tr', { timeout: 10000 });
    
    // Выбираем первый диалог для просмотра участников
    const firstDialogRow = page.locator('.dialogs-panel table tbody tr').first();
    const participantsButton = firstDialogRow.locator('button:has-text("👥 Участники")');
    await participantsButton.click();
    
    // Ждем появления панели участников и таблицы участников
    await page.waitForSelector('#currentMembersListPanel table tbody tr', { timeout: 10000 });
    
    // Нажимаем кнопку "🏷️ Мета" для первого участника
    const metaButton = page.locator('#currentMembersListPanel button:has-text("🏷️ Мета")').first();
    await metaButton.click();
    
    // Проверяем, что модальное окно открылось
    const modal = page.locator('#memberMetaModal');
    await expect(modal).toBeVisible();
    
    // Проверяем заголовок модального окна
    const modalTitle = modal.locator('.modal-title:has-text("Мета-теги участника")');
    await expect(modalTitle).toBeVisible();
    
    // Проверяем наличие редактора мета-тегов
    const editor = modal.locator('#memberMetaEditorModal');
    await expect(editor).toBeVisible();
  });

  test('should close "Мета-теги участника" modal when clicking close button', async ({ page }) => {
    // Выбираем первого пользователя
    const firstUserRow = page.locator('table tbody tr').first();
    await firstUserRow.click();
    
    // Ждем загрузки диалогов
    await page.waitForSelector('.dialogs-panel table tbody tr', { timeout: 10000 });
    
    // Выбираем первый диалог для просмотра участников
    const firstDialogRow = page.locator('.dialogs-panel table tbody tr').first();
    const participantsButton = firstDialogRow.locator('button:has-text("👥 Участники")');
    await participantsButton.click();
    
    // Ждем появления панели участников и таблицы участников
    await page.waitForSelector('#currentMembersListPanel table tbody tr', { timeout: 10000 });
    
    // Открываем модальное окно мета-тегов
    const metaButton = page.locator('#currentMembersListPanel button:has-text("🏷️ Мета")').first();
    await metaButton.click();
    
    // Проверяем, что модальное окно открылось
    const modal = page.locator('#memberMetaModal');
    await expect(modal).toBeVisible();
    
    // Нажимаем кнопку закрытия
    const closeButton = modal.locator('.close');
    await closeButton.click();
    
    // Проверяем, что модальное окно закрылось
    await expect(modal).not.toBeVisible();
  });

  test('should close "Мета-теги участника" modal when pressing Escape key', async ({ page }) => {
    // Выбираем первого пользователя
    const firstUserRow = page.locator('table tbody tr').first();
    await firstUserRow.click();
    
    // Ждем загрузки диалогов
    await page.waitForSelector('.dialogs-panel table tbody tr', { timeout: 10000 });
    
    // Выбираем первый диалог для просмотра участников
    const firstDialogRow = page.locator('.dialogs-panel table tbody tr').first();
    const participantsButton = firstDialogRow.locator('button:has-text("👥 Участники")');
    await participantsButton.click();
    
    // Ждем появления панели участников и таблицы участников
    await page.waitForSelector('#currentMembersListPanel table tbody tr', { timeout: 10000 });
    
    // Открываем модальное окно мета-тегов
    const metaButton = page.locator('#currentMembersListPanel button:has-text("🏷️ Мета")').first();
    await metaButton.click();
    
    // Проверяем, что модальное окно открылось
    const modal = page.locator('#memberMetaModal');
    await expect(modal).toBeVisible();
    
    // Нажимаем Escape
    await page.keyboard.press('Escape');
    
    // Проверяем, что модальное окно закрылось
    await expect(modal).not.toBeVisible();
  });
});

