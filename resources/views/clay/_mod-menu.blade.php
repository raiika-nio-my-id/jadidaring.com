{{-- Admin-only '⋯' moderation menu. Callers render it only under @can('access-admin-panel'); the buttons call the
     /admin panel routes (panel.admin middleware + CSRF), so hiding this markup is cosmetic, never the guard.
     Needs: $what (e.g. 'curhatan', 'komentar'), $deleteUrl; optional $hideUrl, $after (URL to open after a delete). --}}
<span class="jd-mod" data-jd-mod>
    <button type="button" class="jd-mod__btn" aria-haspopup="true" aria-expanded="false" title="Moderasi admin"><span aria-hidden="true">⋯</span><span class="sr-only">Moderasi admin</span></button>
    <span class="jd-mod__menu" hidden>
        <span class="jd-mod__label">Admin</span>
        @if (! empty($hideUrl))
            <button type="button" class="jd-mod__item" data-mod-act="hide" data-url="{{ $hideUrl }}" data-what="{{ $what }}">Sembunyikan</button>
        @endif
        <button type="button" class="jd-mod__item is-danger" data-mod-act="delete" data-url="{{ $deleteUrl }}" data-what="{{ $what }}"@if (! empty($after)) data-after="{{ $after }}"@endif>Hapus</button>
    </span>
</span>
