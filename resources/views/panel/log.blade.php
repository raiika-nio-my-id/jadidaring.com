@extends('panel.layout')
@php $panelTitle = 'Log admin'; @endphp

@section('panel')
    <section class="adm-card">
        <form class="adm-search" method="GET" action="{{ route('panel.log') }}" role="search">
            <input class="clay-input" type="search" name="q" value="{{ $q }}" placeholder="Cari tindakan, target, atau admin…" aria-label="Cari log">
            <button class="adm-btn adm-btn--primary" type="submit">Cari</button>
        </form>
        <div class="adm-table-wrap" style="margin-top:10px">
            <table class="adm-table">
                <thead><tr><th>Waktu (WITA)</th><th>Admin</th><th>Tindakan</th><th>Target</th><th>Detail</th></tr></thead>
                <tbody>
                    @forelse ($logs as $l)
                        <tr>
                            <td style="white-space:nowrap">{{ $l->created_at?->wita() }}</td>
                            <td>{{ $l->actor }}</td>
                            <td><strong>{{ $l->action }}</strong></td>
                            <td>{{ $l->target_type }}@if($l->target_id) #{{ $l->target_id }}@endif @if($l->target_label)<br><span class="adm-muted">{{ $l->target_label }}</span>@endif</td>
                            <td style="max-width:280px;overflow-wrap:anywhere" class="adm-muted">{{ $l->meta ? json_encode($l->meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '' }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="adm-empty">Belum ada log.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
        @include('panel._pager', ['p' => $logs])
    </section>
@endsection
