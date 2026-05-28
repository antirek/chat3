import { test, expect } from '@playwright/test';

const API_KEY = 'chat3_91b81eff6a450427e9e8f7e9bcd8431e02982871623301321890736ab97d55d7';
const TENANT_ID = 'tnt_default';
const DIALOG_ID = 'dlg_rg5ywcijezquc8jibyqs';

test.describe('Add Member Modal - Пользователи + Диалоги + Сообщения', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`http://localhost:3001/api-test-user-dialogs.html?apiKey=${API_KEY}&tenantId=${TENANT_ID}`);
    await page.waitForSelector('#usersList table tbody tr', { state: 'visible' });
    
    // Кликаем на ячейку с userId для выбора пользователя (не на кнопку Инфо)
    await page.click('#usersList table tbody tr:first-child td:first-child');
    await page.waitForSelector('#dialogsList table tbody tr', { state: 'visible', timeout: 10000 });
    
    // Выбираем диалог и открываем участников
    await page.click('#dialogsList table tbody tr:first-child button:has-text("👥 Участники")');
    await page.waitForSelector('#membersPanelContent', { state: 'visible' });
    await page.waitForSelector('#currentMembersListPanel table tbody tr', { state: 'visible', timeout: 10000 });
  });

  test('should open "Добавить участника" modal when clicking "➕ Добавить" button', async ({ page }) => {
    const addMemberButton = page.locator('#addMemberBtn');
    await expect(addMemberButton).toBeVisible();
    await expect(addMemberButton).toHaveText('➕ Добавить');
    
    await addMemberButton.click();
    
    const modal = page.locator('#addMemberModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toHaveText('Добавить участника');
  });

  test('should have user select, type select, and meta tags fields in modal', async ({ page }) => {
    await page.click('#addMemberBtn');
    await page.waitForSelector('#addMemberModal', { state: 'visible' });
    
    // Проверяем наличие полей
    await expect(page.locator('#newMemberSelectModal')).toBeVisible();
    await expect(page.locator('#newMemberTypeModal')).toBeVisible();
    await expect(page.locator('#newMemberMetaContainerModal')).toBeVisible();
    
    // Проверяем опции типа участника (проверяем наличие в DOM, не видимость)
    const typeSelect = page.locator('#newMemberTypeModal');
    await expect(typeSelect.locator('option[value="user"]')).toHaveCount(1);
    await expect(typeSelect.locator('option[value="bot"]')).toHaveCount(1);
    await expect(typeSelect.locator('option[value="contact"]')).toHaveCount(1);
  });

  test('should load users list in select', async ({ page }) => {
    await page.click('#addMemberBtn');
    await page.waitForSelector('#addMemberModal', { state: 'visible' });
    
    // Ждем загрузки списка пользователей (может занять время)
    await page.waitForSelector('#newMemberSelectModal option:not([value=""])', { state: 'attached', timeout: 10000 });
    
    const select = page.locator('#newMemberSelectModal');
    const options = await select.locator('option').all();
    
    // Должно быть больше одной опции (кроме пустой)
    expect(options.length).toBeGreaterThan(1);
    
    // Проверяем, что есть хотя бы один тестовый пользователь или существующий пользователь
    const hasTestUser = await select.locator('option[value^="test_user_"]').count() > 0;
    const hasRegularUser = await select.locator('option[value="carl"], option[value="marta"], option[value="sara"]').count() > 0;
    expect(hasTestUser || hasRegularUser).toBeTruthy();
  });

  test('should add and remove meta tag rows', async ({ page }) => {
    await page.click('#addMemberBtn');
    await page.waitForSelector('#addMemberModal', { state: 'visible' });
    
    // Проверяем начальное количество строк мета-тегов (должна быть одна)
    const initialRows = page.locator('#newMemberMetaContainerModal .meta-tag-row');
    await expect(initialRows).toHaveCount(1);
    
    // Добавляем строку мета-тега
    const addButton = page.locator('#addMemberModal button:has-text("➕ Добавить мета-тег")');
    await expect(addButton).toBeVisible();
    await addButton.click();
    await expect(initialRows).toHaveCount(2);
    
    // Удаляем строку
    const removeButtons = page.locator('#newMemberMetaContainerModal .remove-meta-btn');
    const removeButtonCount = await removeButtons.count();
    if (removeButtonCount > 0) {
      await removeButtons.last().click();
      await expect(initialRows).toHaveCount(1);
    }
  });

  test('should close modal when clicking close button', async ({ page }) => {
    await page.click('#addMemberBtn');
    await expect(page.locator('#addMemberModal')).toBeVisible();
    
    await page.click('#addMemberModal .close');
    await expect(page.locator('#addMemberModal')).not.toBeVisible();
  });

  test('should close modal when pressing Escape key', async ({ page }) => {
    await page.click('#addMemberBtn');
    await expect(page.locator('#addMemberModal')).toBeVisible();
    
    await page.keyboard.press('Escape');
    await expect(page.locator('#addMemberModal')).not.toBeVisible();
  });

  test('should add member with type and meta tags', async ({ page }) => {
    // Находим пользователя, которого еще нет в диалоге
    // Используем нового пользователя для теста
    const testUserId = 'test_user_new_member';
    
    // Создаем пользователя через API перед тестом
    await page.evaluate(async ({ userId, apiKey, tenantId }) => {
      try {
        await fetch(`/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
            'X-TENANT-ID': tenantId
          },
          body: JSON.stringify({ userId })
        });
      } catch (e) {
        // Игнорируем ошибки
      }
    }, { userId: testUserId, apiKey: API_KEY, tenantId: TENANT_ID });
    
    await page.waitForTimeout(1000);
    
    await page.click('#addMemberBtn');
    await page.waitForSelector('#addMemberModal', { state: 'visible' });
    await page.waitForSelector(`#newMemberSelectModal option[value="${testUserId}"]`, { state: 'visible', timeout: 10000 });
    
    // Выбираем пользователя
    await page.selectOption('#newMemberSelectModal', testUserId);
    
    // Выбираем тип
    await page.selectOption('#newMemberTypeModal', 'bot');
    
    // Добавляем мета-теги
    const keyInput = page.locator('#newMemberMetaContainerModal .meta-key-input').first();
    const valueInput = page.locator('#newMemberMetaContainerModal .meta-value-input').first();
    
    await keyInput.fill('role');
    await valueInput.fill('admin');
    
    // Добавляем еще один мета-тег
    await page.click('#addMemberModal button:has-text("➕ Добавить мета-тег")');
    const secondKeyInput = page.locator('#newMemberMetaContainerModal .meta-key-input').nth(1);
    const secondValueInput = page.locator('#newMemberMetaContainerModal .meta-value-input').nth(1);
    
    await secondKeyInput.fill('department');
    await secondValueInput.fill('support');
    
    // Обрабатываем alert диалоги
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    // Отправляем форму
    await page.click('#addMemberFormModal button[type="submit"]');
    
    // Ждем закрытия модального окна
    await page.waitForSelector('#addMemberModal', { state: 'hidden', timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Проверяем, что участник добавлен в список (может быть на другой странице пагинации)
    const memberExists = await page.locator(`#currentMembersListPanel:has-text("${testUserId}")`).count() > 0;
    expect(memberExists).toBeTruthy();
  });

  test('should validate required user field', async ({ page }) => {
    await page.click('#addMemberBtn');
    await page.waitForSelector('#addMemberModal', { state: 'visible' });
    
    // Пытаемся отправить форму без выбора пользователя
    await page.click('#addMemberFormModal button[type="submit"]');
    
    // Должно появиться сообщение об ошибке или форма не должна отправиться
    // Проверяем, что модальное окно все еще открыто
    await expect(page.locator('#addMemberModal')).toBeVisible();
  });

  test('should reset form when closing modal', async ({ page }) => {
    await page.click('#addMemberBtn');
    await page.waitForSelector('#addMemberModal', { state: 'visible' });
    
    // Ждем загрузки списка пользователей
    await page.waitForSelector('#newMemberSelectModal option:not([value=""])', { state: 'attached', timeout: 10000 });
    
    // Получаем первый доступный пользователь из списка
    const firstOption = await page.locator('#newMemberSelectModal option:not([value=""])').first();
    const firstUserId = await firstOption.getAttribute('value');
    
    if (firstUserId) {
      // Заполняем форму
      await page.selectOption('#newMemberSelectModal', firstUserId);
      await page.selectOption('#newMemberTypeModal', 'user');
      
      const keyInput = page.locator('#newMemberMetaContainerModal .meta-key-input').first();
      const valueInput = page.locator('#newMemberMetaContainerModal .meta-value-input').first();
      await keyInput.fill('test_key');
      await valueInput.fill('test_value');
    }
    
    // Закрываем модальное окно
    await page.click('#addMemberModal .close');
    await page.waitForSelector('#addMemberModal', { state: 'hidden' });
    
    // Открываем снова
    await page.click('#addMemberBtn');
    await page.waitForSelector('#addMemberModal', { state: 'visible' });
    
    // Проверяем, что форма сброшена
    const selectValue = await page.locator('#newMemberSelectModal').inputValue();
    const typeValue = await page.locator('#newMemberTypeModal').inputValue();
    const keyValue = await page.locator('#newMemberMetaContainerModal .meta-key-input').first().inputValue();
    const valueValue = await page.locator('#newMemberMetaContainerModal .meta-value-input').first().inputValue();
    
    expect(selectValue).toBe('');
    expect(typeValue).toBe('');
    expect(keyValue).toBe('');
    expect(valueValue).toBe('');
  });
});

