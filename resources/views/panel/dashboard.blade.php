@extends('panel.layout')
@php $panelTitle = 'Ringkasan'; @endphp

@section('panel')
    <div class="adm-grid">
        @foreach ($counts as $c)
            <a class="adm-stat adm-stat--{{ $c['tone'] }}" href="{{ $c['href'] }}">
                <span class="adm-stat__v">{{ number_format($c['value'], 0, ',', '.') }}</span>
                <span class="adm-stat__l">{{ $c['label'] }}</span>
                @isset($c['sub'])<span class="adm-stat__s">{{ $c['sub'] }}</span>@endisset
            </a>
        @endforeach
    </div>

    @if (array_sum($reported) > 0)
        <div class="adm-note adm-note--warn" role="status">
            Perlu dicek:
            @if ($reported['curhatan'])<a href="{{ route('panel.community.posts', ['f' => 'dilaporkan']) }}">{{ $reported['curhatan'] }} curhatan dilaporkan</a>@endif
            @if ($reported['profil']) · <a href="{{ route('panel.community', ['status' => 'dilaporkan']) }}">{{ $reported['profil'] }} profil dilaporkan</a>@endif
            @if ($reported['komentar']) · <a href="{{ route('panel.community.comments', ['f' => 'dilaporkan']) }}">{{ $reported['komentar'] }} komentar profil dilaporkan</a>@endif
        </div>
    @endif

    <section class="adm-card" aria-labelledby="ga-h">
        <div class="adm-top"><h2 id="ga-h">Google Analytics · 28 hari</h2><a class="adm-btn adm-btn--sky" href="{{ route('panel.stats') }}">Statistik lengkap</a></div>
        <div data-adm-lazy="{{ route('panel.home.ga') }}">
            <div class="adm-grid" style="margin-bottom:12px">@for ($i = 0; $i < 3; $i++)<div class="adm-sk" style="height:64px;border-radius:18px"></div>@endfor</div>
            <div class="adm-sk" style="height:150px;border-radius:18px"></div>
        </div>
    </section>

    <div class="adm-cols">
        <section class="adm-card" aria-labelledby="act-h">
            <h2 id="act-h">Aktivitas terbaru</h2>
            @forelse ($activity as $a)
                <a class="adm-act" href="{{ $a['href'] }}"><span class="adm-act__i" aria-hidden="true">{{ $a['icon'] }}</span><span class="adm-act__t">{{ $a['text'] }}</span><span class="adm-act__w" title="{{ $a['at']->wita() }}">{{ $a['at']->diffForHumans() }}</span></a>
            @empty
                <p class="adm-empty">Belum ada aktivitas.</p>
            @endforelse
        </section>
        <section class="adm-card" aria-labelledby="log-h">
            <div class="adm-top"><h2 id="log-h">Tindakan admin</h2><a class="adm-btn" href="{{ route('panel.log') }}">Semua log</a></div>
            @forelse ($audit as $l)
                <div class="adm-act"><span class="adm-act__i" aria-hidden="true">🧾</span><span class="adm-act__t"><strong>{{ $l->action }}</strong>@if($l->target_label) · {{ $l->target_label }}@endif<br><span class="adm-muted">{{ $l->actor }}</span></span><span class="adm-act__w" title="{{ $l->created_at?->wita() }}">{{ $l->created_at?->diffForHumans() }}</span></div>
            @empty
                <p class="adm-empty">Belum ada tindakan admin.</p>
            @endforelse
        </section>
    </div>
@endsection
