@if (! empty($providers))
    @php
        $icons = [
            'google' => '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.5 2.4-2.5 3.55-5.35 3.55a5.8 5.8 0 1 1 0-11.6c1.45 0 2.6.55 3.5 1.35l2.1-2.1A8.8 8.8 0 0 0 12 3.2a8.8 8.8 0 1 0 0 17.6c5.1 0 8.5-3.6 8.5-8.6 0-.4-.05-.75-.15-1.1z"/></svg>',
            'github' => '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.52 1.03 1.52 1.03.89 1.52 2.34 1.08 2.9.83.09-.64.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.9-1.29 2.74-1.02 2.74-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>',
            'telegram' => '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M21.9 4.1 18.7 19.2c-.24 1.06-.87 1.32-1.76.82l-4.86-3.58-2.35 2.26c-.26.26-.48.48-.98.48l.35-4.96 9.03-8.16c.39-.35-.09-.54-.61-.19L6.36 12.9l-4.8-1.5c-1.04-.33-1.06-1.04.22-1.54L20.55 2.6c.87-.32 1.63.2 1.35 1.5z"/></svg>',
        ];
        $labels = ['google' => 'Google', 'github' => 'GitHub', 'telegram' => 'Telegram'];
    @endphp
    <div class="clay-social">
        <p class="clay-social__label">atau lanjutkan dengan</p>
        @foreach ($providers as $provider)
            @if ($provider === 'telegram')
                <button type="button" class="clay-btn clay-btn--sky clay-social__btn" id="tg-login"
                    data-bot-id="{{ explode(':', (string) config('services.telegram.bot_token'))[0] }}"
                    data-callback="{{ route('member.telegram.callback') }}">{!! $icons['telegram'] !!}<span>Telegram</span></button>
                <p class="clay-social__msg" id="tg-msg" role="status" hidden></p>
                <script src="https://telegram.org/js/telegram-widget.js?22" async></script>
                <script src="{{ \App\Support\AssetUrl::to('js/telegram-login.js') }}" defer></script>
            @else
                <a class="clay-btn clay-btn--sky clay-social__btn" href="{{ route('member.social.redirect', $provider) }}">{!! $icons[$provider] ?? '' !!}<span>{{ $labels[$provider] ?? ucfirst($provider) }}</span></a>
            @endif
        @endforeach
    </div>
@endif
