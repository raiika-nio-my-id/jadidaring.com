<script>
    (function () {
        try {
            var stored = localStorage.getItem('jadidaring-theme');
            var theme = (stored === 'light' || stored === 'dark')
                ? stored
                : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            document.documentElement.setAttribute('data-theme', theme);
            document.documentElement.style.colorScheme = theme;
            var m = document.querySelector('meta[name=theme-color]');
            if (m && !m.hasAttribute('data-fixed')) { m.setAttribute('content', theme === 'dark' ? '#1F1B2E' : '#F7F2EC'); }
        } catch (error) {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    })();
</script>
