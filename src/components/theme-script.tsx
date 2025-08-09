export function ThemeScript() {
  // Inline script that sets the initial theme before React hydration to prevent a flash
  const code = `(() => {
    try {
      const storageKey = 'theme';
      const stored = localStorage.getItem(storageKey);
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const useDark = stored ? stored === 'dark' : prefersDark;
      const root = document.documentElement;
      if (useDark) root.classList.add('dark');
      else root.classList.remove('dark');
    } catch (_) {}
  })();`;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}


