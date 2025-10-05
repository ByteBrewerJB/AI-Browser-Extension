async function runSequentially() {
  await import('./content/sidebarIntegration.spec');
  await import('./content/bookmarks.test');
  await import('./promptChains.spec');
  await import('./conversationIngestion.spec');
  await import('./jobScheduler.spec');
  await import('./backgroundMessaging.spec');
}

runSequentially()
  .catch((error) => {
    console.error('[tests] unhandled error during runAll', error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
