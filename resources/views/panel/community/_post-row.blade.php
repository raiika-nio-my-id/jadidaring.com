<li class="adm-row">
    <div class="adm-row__main">
        <span class="adm-row__meta"><strong>{{ $post->user ? '@'.$post->user->username : '' }}</strong> · {{ $post->created_at?->wita() }} · {{ \App\Models\MemberPost::VISIBILITIES[$post->visibility] ?? $post->visibility }} · ❤ {{ $post->likes_count }} · 💬 {{ $post->comments_count }} @if($post->is_hidden)<span class="adm-badge adm-badge--bad">Disembunyikan</span>@endif @if($post->reports_count)<span class="adm-badge adm-badge--warn">⚑ {{ $post->reports_count }}</span>@endif @if($post->image)<span>🖼 ada gambar</span>@endif</span>
        <p class="adm-row__body">{{ \Illuminate\Support\Str::limit((string) $post->body, 400) }}</p>
    </div>
    <div class="adm-row__tools">
        @if ($post->user)<a class="adm-btn" href="{{ $post->url() }}" target="_blank" rel="noopener" data-no-skel>Buka</a>@endif
        <form method="POST" action="{{ route('panel.community.posts.toggle', $post->id) }}">@csrf<button class="adm-btn {{ $post->is_hidden ? 'adm-btn--mint' : 'adm-btn--peach' }}" type="submit">{{ $post->is_hidden ? 'Tampilkan' : 'Sembunyikan' }}</button></form>
        <form method="POST" action="{{ route('panel.community.posts.destroy', $post->id) }}" data-confirm="Hapus curhatan ini beserta komentarnya secara permanen? (backup tetap disimpan)" data-confirm-ok="Hapus">@csrf @method('DELETE')<button class="adm-btn adm-btn--danger" type="submit">Hapus</button></form>
    </div>
</li>
