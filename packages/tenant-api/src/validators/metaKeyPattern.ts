/**
 * Алфавит meta-ключа: только буквы, цифры и подчёркивание.
 * Точка и дефис запрещены (разделитель — подчёркивание, например contact_phone).
 */
export const META_KEY_PATTERN = /^[a-zA-Z0-9_]+$/;
export const META_KEY_MAX_LENGTH = 100;
export const META_KEY_INVALID_MESSAGE =
  'Meta key may only contain letters, numbers, and underscores (no dots or hyphens). Example: contact_phone';
