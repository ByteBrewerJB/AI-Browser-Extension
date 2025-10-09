async function runSequentially() {
  await import('./content/sidebarIntegration.spec');
  await import('./content/bookmarks.test');
  await import('./content/inlineLauncherTriggers.spec');
  await import('./promptChains.spec');
  await import('./conversationIngestion.spec');
  await import('./jobScheduler.spec');
  await import('./core/searchService.spec');
  await import('./core/chainDslParser.spec');
  await import('./backgroundMessaging.spec');
  await import('./background/syncEncryptionService.spec');
  await import('./background/networkMonitor.spec');
  await import('./shared/bubbleLauncherStore.spec');
  await import('./shared/syncEncryptionClient.spec');
  await import('./shared/theme/themePreference.spec');
  await import('./options/mediaGallery.spec');
}

runSequentially()
  .catch((error) => {
    console.error('[tests] unhandled error during runAll', error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
