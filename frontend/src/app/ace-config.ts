import * as ace from 'ace-builds';

export function configureAce() {
  return () => {
    try {
      const basePath = '/assets/ace-builds';
      ace.config.set('basePath', basePath);
      ace.config.set('modePath', basePath);
      ace.config.set('themePath', basePath);
      ace.config.set('workerPath', basePath);

      console.log('[Debug] ACE editor configuration completed');
      return Promise.resolve();
    } catch (error) {
      console.error('[Debug] ACE editor configuration failed:', error);
      return Promise.reject(error);
    }
  };
}
