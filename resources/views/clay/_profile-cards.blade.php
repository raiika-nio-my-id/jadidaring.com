@foreach ($pages as $p)
    @php $cfg = $p->profileConfig(); $pr = $cfg['profile']; @endphp
    <a class="pf-mini" href="/u/{{ $p->user->username }}">
        @if ($pr['avatar'] !== '')
            <img class="pf-mini__av" src="{{ $pr['avatar'] }}" alt="" width="56" height="56" loading="lazy" referrerpolicy="no-referrer">
        @else
            <span class="pf-mini__av pf-mini__av--ph" aria-hidden="true">{{ mb_strtoupper(mb_substr($p->user->name, 0, 1)) }}</span>
        @endif
        <span class="pf-mini__body">
            <strong>{{ $p->user->name }}</strong>
            <span class="pf-user">{{ '@'.$p->user->username }}</span>
            @if ($pr['tagline'] !== '')<span class="pf-mini__tag">{{ $pr['tagline'] }}</span>@endif
            <span class="news-date">{{ number_format($p->followers_count ?? 0) }} pengikut · {{ number_format($p->views) }} pengunjung</span>
        </span>
    </a>
@endforeach
