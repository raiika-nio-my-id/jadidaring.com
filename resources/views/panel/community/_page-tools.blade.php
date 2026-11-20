<form method="POST" action="{{ route('panel.community.status', $p->id) }}" @if($p->status === 'published') data-confirm="Sembunyikan profil {{ '@'.($p->user?->username) }} dari publik?" data-confirm-ok="Sembunyikan" @endif>
    @csrf
    <input type="hidden" name="status" value="{{ $p->status === 'published' ? 'hidden' : 'published' }}">
    <button class="adm-btn {{ $p->status === 'published' ? 'adm-btn--peach' : 'adm-btn--mint' }}" type="submit">{{ $p->status === 'published' ? 'Sembunyikan' : 'Tampilkan' }}</button>
</form>
<form method="POST" action="{{ route('panel.community.reset', $p->id) }}" data-confirm="Reset hitungan pengunjung {{ '@'.($p->user?->username) }} ({{ number_format($p->views, 0, ',', '.') }}) ke 0?" data-confirm-ok="Reset ke 0">
    @csrf
    <button class="adm-btn" type="submit">Reset pengunjung</button>
</form>
