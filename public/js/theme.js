(function () {
    const storageKey = 'jadidaring-theme';

    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function syncButtons(theme) {
        const next = theme === 'dark' ? 'light' : 'dark';
        document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
            button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
            button.setAttribute('aria-label', next === 'dark' ? 'Switch to dark mode' : 'Switch to light mode');
            button.setAttribute('title', button.getAttribute('aria-label'));
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
        syncButtons(theme);
    }

    // Dimming-lamp switch: ~600ms crossfade (View Transition, else a temporary transition class). Instant under reduced motion.
    const root = document.documentElement;
    let fadeTimer = null;
    function swapTheme(next) {
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
            if (reduce) { return; }
            b.classList.remove('jd-spin'); void b.offsetWidth; b.classList.add('jd-spin');
            setTimeout(() => b.classList.remove('jd-spin'), 700);
        });
        if (reduce) { applyTheme(next); return; }
        clearTimeout(fadeTimer);
        if (document.startViewTransition) {
            root.classList.add('jd-theme-vt');
            const t = document.startViewTransition(() => { applyTheme(next); });
            const done = () => root.classList.remove('jd-theme-vt');
            t.finished.then(done, done);
            return;
        }
        root.classList.add('jd-theme-fade');
        applyTheme(next);
        fadeTimer = setTimeout(() => root.classList.remove('jd-theme-fade'), 750);
    }

    window.__setTheme = function (theme) {
        const next = theme === 'dark' ? 'dark' : 'light';
        try {
            localStorage.setItem(storageKey, next);
        } catch (error) {
            // Ignore private-mode storage failures.
        }
        swapTheme(next);
    };

    window.__toggleTheme = function () {
        window.__setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    };

    document.addEventListener('click', (event) => {
        const toggle = event.target.closest('[data-theme-toggle]');
        if (toggle) {
            window.__toggleTheme();
        }

        const navToggle = event.target.closest('[data-nav-toggle]');
        if (navToggle) {
            const header = navToggle.closest('.app-header');
            const open = header?.classList.toggle('is-open');
            navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
    });

    applyTheme(currentTheme());
})();
