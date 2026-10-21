export function ThemeScript() {
  // Inline script that sets the initial theme before React hydration to prevent a flash
  const code = `(() => {
    let stored;
    try { stored = localStorage.getItem('theme'); } catch (_) {}
    try {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const useDark = stored === 'dark' || (stored !== 'light' && prefersDark);
      const root = document.documentElement;
      root.classList.toggle('dark', Boolean(useDark));
      root.style.colorScheme = useDark ? 'dark' : 'light';
    } catch (_) {}
  })();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
