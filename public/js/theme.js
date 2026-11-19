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

    // Status bar colour (<meta name="theme-color">) follows the page background. Profile pages pin their own colour (data-fixed).
    const BAR = { light: '#F7F2EC', dark: '#1F1B2E' };
    const barMeta = () => document.querySelector('meta[name="theme-color"]');
    let barTween = 0;
    const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const toHex = (a) => '#' + a.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    window.__setThemeColor = function (color, animate, ms) {
        const m = barMeta();
        if (!m || !/^#[0-9a-fA-F]{6}$/.test(color)) { return; }
        cancelAnimationFrame(barTween);
        const from = /^#[0-9a-fA-F]{6}$/.test(m.content) ? hex(m.content) : null;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!animate || reduce || !from) { m.setAttribute('content', color); return; }
        const to = hex(color), dur = ms || 600, t0 = performance.now();
        const step = (t) => {
            const k = Math.min(1, (t - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            m.setAttribute('content', k >= 1 ? color : toHex(from.map((v, i) => v + (to[i] - v) * e)));
            if (k < 1) { barTween = requestAnimationFrame(step); }
        };
        barTween = requestAnimationFrame(step);
    };
    window.__defaultThemeColor = function () { return BAR[currentTheme()]; };
    function syncBar(animate) {
        const m = barMeta();
        if (m && !m.hasAttribute('data-fixed')) { window.__setThemeColor(BAR[currentTheme()], animate); }
    }
    // A bfcache restore (back to a profile) brings back the page's own colour.
    window.addEventListener('pageshow', (e) => {
        const m = barMeta();
        if (e.persisted && m) { m.setAttribute('content', m.hasAttribute('data-fixed') ? (m.dataset.pageColor || m.content) : BAR[currentTheme()]); }
    });
    document.addEventListener('DOMContentLoaded', () => {
        const m = barMeta();
        if (m && m.hasAttribute('data-fixed')) { m.dataset.pageColor = m.content; }
    });

    let barAnimate = false;
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
        syncButtons(theme);
        syncBar(barAnimate);
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
        if (reduce) { applyTheme(next); syncBar(false); return; }
        clearTimeout(fadeTimer);
        barAnimate = true;
        setTimeout(() => { barAnimate = false; }, 700);
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
