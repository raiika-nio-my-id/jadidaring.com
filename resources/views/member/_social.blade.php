@if (! empty($providers))
    <div class="clay-social">
        <p class="clay-social__label">atau lanjutkan dengan</p>
        @foreach ($providers as $provider)
            @if ($provider === 'telegram')
                <div class="clay-social__telegram">
                    <script async src="https://telegram.org/js/telegram-widget.js?22"
                        data-telegram-login="{{ config('services.telegram.bot_username') }}"
                        data-size="large"
                        data-radius="20"
                        data-auth-url="{{ route('member.telegram.callback') }}"
                        data-request-access="write"></script>
                </div>
            @else
                <a class="clay-btn clay-btn--sky" href="{{ route('member.social.redirect', $provider) }}">{{ ucfirst($provider) }}</a>
            @endif
        @endforeach
    </div>
@endif
