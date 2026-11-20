<li class="adm-row">
    <div class="adm-row__main">
        <span class="adm-row__meta"><strong>{{ $c->user ? '@'.$c->user->username : 'akun dihapus' }}</strong>@isset($showOwner) → di profil {{ '@'.($c->page?->user?->username) }}@endisset · {{ $c->created_at?->wita() }} @if($c->is_hidden)<span class="adm-badge adm-badge--bad">Disembunyikan</span>@endif @if($c->reports_count)<span class="adm-badge adm-badge--warn">⚑ {{ $c->reports_count }}</span>@endif</span>
        <p class="adm-row__body">{{ $c->body }}</p>
    </div>
    <div class="adm-row__tools">
        <form method="POST" action="{{ route('panel.community.comments.toggle', $c->id) }}">@csrf<button class="adm-btn {{ $c->is_hidden ? 'adm-btn--mint' : 'adm-btn--peach' }}" type="submit">{{ $c->is_hidden ? 'Tampilkan' : 'Sembunyikan' }}</button></form>
        <form method="POST" action="{{ route('panel.community.comments.destroy', $c->id) }}" data-confirm="Hapus komentar ini permanen? (backup tetap disimpan)" data-confirm-ok="Hapus">@csrf @method('DELETE')<button class="adm-btn adm-btn--danger" type="submit">Hapus</button></form>
    </div>
</li>
