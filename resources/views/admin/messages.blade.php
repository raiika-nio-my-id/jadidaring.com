@extends('layouts.admin')

@section('title', 'Pesan kontak')

@section('content')
    <div class="page-heading"><div><h1>Pesan kontak</h1><p class="muted lede">Kiriman dari formulir /kontak di jadidaring.com.</p></div></div>
    @forelse ($messages as $m)
        <article class="card" style="margin-bottom:12px;padding:14px;{{ $m->read_at ? 'opacity:.7' : '' }}">
            <strong>{{ $m->subject }}</strong> <span class="muted">· {{ $m->name }}@if($m->email) · {{ $m->email }}@endif · {{ $m->created_at->format('d M Y H:i') }}</span>
            <p style="white-space:pre-wrap">{{ $m->message }}</p>
            <div class="row-actions">
                @unless($m->read_at)
                    <form method="post" action="{{ route('admin.messages.read', $m) }}" style="display:inline">@csrf<button class="button button-quiet button-small">Tandai dibaca</button></form>
                @endunless
                <form method="post" action="{{ route('admin.messages.destroy', $m) }}" style="display:inline" onsubmit="return confirm('Hapus pesan ini?')">@csrf @method('DELETE')<button class="button button-quiet button-small">Hapus</button></form>
            </div>
        </article>
    @empty
        <p class="muted">Belum ada pesan.</p>
    @endforelse
    {{ $messages->links() }}
@endsection
