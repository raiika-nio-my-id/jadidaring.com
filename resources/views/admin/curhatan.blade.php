@extends('layouts.admin')

@section('title', 'Curhatan')

@section('content')
    <div class="page-heading"><div><h1>Curhatan</h1><p class="muted lede">Moderasi postingan member di jadidaring.com. Postingan otomatis disembunyikan setelah {{ \App\Models\MemberPost::AUTO_HIDE_REPORTS }} laporan.</p></div></div>
    @if (session('status'))<p class="muted" role="status">{{ session('status') }}</p>@endif
    <p class="row-actions">
        @foreach (['dilaporkan' => 'Dilaporkan', 'disembunyikan' => 'Disembunyikan', 'terbaru' => 'Terbaru'] as $f => $label)
            <a href="{{ route('admin.curhatan', ['f' => $f]) }}" class="button button-small {{ $filter === $f ? '' : 'button-quiet' }}">{{ $label }}</a>
        @endforeach
    </p>
    @forelse ($posts as $p)
        <article class="card" style="margin-bottom:12px;padding:14px;{{ $p->is_hidden ? 'opacity:.75' : '' }}">
            <strong>{{ '@'.($p->user?->username ?? '?') }}</strong>
            <span class="muted">· #{{ $p->id }} · {{ \App\Models\MemberPost::VISIBILITIES[$p->visibility] ?? $p->visibility }} · {{ $p->created_at->format('d M Y H:i') }} · {{ $p->reports_count }} laporan · {{ $p->likes_count }} suka · {{ $p->comments_count }} komentar @if ($p->is_hidden)· <strong>DISEMBUNYIKAN</strong>@endif</span>
            <p style="white-space:pre-wrap">{{ $p->body }}</p>
            @if ($p->image)<p class="muted">[+ 1 gambar]</p>@endif
            @php $reasons = \Illuminate\Support\Facades\DB::table('member_post_reports')->where('target', 'p:'.$p->id)->whereNotNull('reason')->limit(5)->pluck('reason'); @endphp
            @foreach ($reasons as $r)<p class="muted">Alasan: {{ $r }}</p>@endforeach
            <form method="post" action="{{ route('admin.curhatan.post', $p) }}" style="display:inline">@csrf<button class="button button-small {{ $p->is_hidden ? '' : 'button-quiet' }}">{{ $p->is_hidden ? 'Tampilkan lagi' : 'Sembunyikan' }}</button></form>
        </article>
    @empty
        <p class="muted">Tidak ada curhatan di daftar ini.</p>
    @endforelse
    {{ $posts->links() }}

    <h2 style="margin-top:28px">Komentar dilaporkan / disembunyikan</h2>
    @forelse ($comments as $c)
        <article class="card" style="margin-bottom:10px;padding:12px;{{ $c->is_hidden ? 'opacity:.75' : '' }}">
            <strong>{{ '@'.($c->user?->username ?? '?') }}</strong> <span class="muted">· di curhatan #{{ $c->member_post_id }} · {{ $c->reports_count }} laporan @if ($c->is_hidden)· <strong>DISEMBUNYIKAN</strong>@endif</span>
            <p style="white-space:pre-wrap">{{ $c->body }}</p>
            <form method="post" action="{{ route('admin.curhatan.comment', $c) }}" style="display:inline">@csrf<button class="button button-small {{ $c->is_hidden ? '' : 'button-quiet' }}">{{ $c->is_hidden ? 'Tampilkan lagi' : 'Sembunyikan' }}</button></form>
        </article>
    @empty
        <p class="muted">Belum ada komentar yang dilaporkan.</p>
    @endforelse
@endsection
