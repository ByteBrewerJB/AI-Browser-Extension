import assert from 'node:assert/strict';

import { isThemePreference, resolveTheme } from '@/shared/theme/themePreference';

async function run() {
  assert.equal(resolveTheme('light'), 'light');
  assert.equal(resolveTheme('dark'), 'dark');
  assert.equal(resolveTheme('high-contrast'), 'high-contrast');

  assert.equal(resolveTheme('system', { prefersHighContrast: true, prefersDark: true }), 'high-contrast');
  assert.equal(resolveTheme('system', { prefersHighContrast: false, prefersDark: true }), 'dark');
  assert.equal(resolveTheme('system', { prefersHighContrast: false, prefersDark: false }), 'light');

  assert.ok(isThemePreference('system'));
  assert.ok(isThemePreference('light'));
  assert.ok(isThemePreference('dark'));
  assert.ok(isThemePreference('high-contrast'));

  assert.ok(!isThemePreference('contrast'));
  assert.ok(!isThemePreference(null));
  assert.ok(!isThemePreference(42));
}

await run();
