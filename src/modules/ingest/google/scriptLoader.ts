/** Loads a third-party script once. Later calls for the same URL share the first promise. */
const loading = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  let promise = loading.get(src);
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loading.delete(src);
        script.remove();
        reject(new Error(`Could not load ${src}. Check your connection or any content blocker.`));
      };
      document.head.append(script);
    });
    loading.set(src, promise);
  }
  return promise;
}
