@extends('panel.layout')
@php $panelTitle = 'Edit berita'; @endphp

@section('panel')
    @include('panel.news._sub')
    <section class="adm-card">
        <div class="adm-top">
            <div>
                <h2 style="margin:0">{{ $article->title }}</h2>
                <p class="adm-row__meta">@include('panel._status', ['s' => $article->status]) #{{ $article->id }} · {{ $article->slug }} · 💬 {{ $article->comments_count }} · diperbarui {{ $article->updated_at?->wita() }}</p>
            </div>
            <div class="adm-row__tools">
                <a class="adm-btn" href="{{ $article->url() }}" target="_blank" rel="noopener" data-no-skel>Lihat di situs ↗</a>
                <form method="POST" action="{{ route('panel.news.status', $article->id) }}" @if($article->status === 'published') data-confirm="Sembunyikan artikel ini dari situs?" data-confirm-ok="Sembunyikan" @endif>
                    @csrf
                    <input type="hidden" name="status" value="{{ $article->status === 'published' ? 'hidden' : 'published' }}">
                    <button class="adm-btn {{ $article->status === 'published' ? 'adm-btn--peach' : 'adm-btn--mint' }}" type="submit">{{ $article->status === 'published' ? 'Sembunyikan' : 'Terbitkan' }}</button>
                </form>
            </div>
        </div>
        <form class="adm-form" method="POST" action="{{ route('panel.news.update', $article->id) }}">
            @csrf
            @method('PUT')
            @include('panel.news._fields', ['article' => $article])
            <h3 style="margin-top:10px">Kredit foto</h3>
            @if ($article->image_path)
                <img src="{{ \App\Services\NewsImage::src($article->id, 480, ($article->image_updated_at ?? $article->updated_at)?->timestamp) }}" alt="" style="max-width:320px;width:100%;border-radius:14px" loading="lazy">
            @else
                <p class="adm-muted">Artikel ini belum punya foto (pakai kartu judul otomatis).</p>
            @endif
            <div class="adm-form-grid">
                <div class="adm-form"><label for="image_alt">Teks alt</label><input class="clay-input" id="image_alt" name="image_alt" value="{{ old('image_alt', $article->image_alt) }}" maxlength="200"></div>
                <div class="adm-form"><label for="image_credit">Kredit</label><input class="clay-input" id="image_credit" name="image_credit" value="{{ old('image_credit', $article->image_credit) }}" maxlength="200"></div>
                <div class="adm-form"><label for="image_source_url">URL sumber (https)</label><input class="clay-input" id="image_source_url" name="image_source_url" type="url" value="{{ old('image_source_url', $article->image_source_url) }}" maxlength="500"></div>
                <div class="adm-form"><label for="image_license">Lisensi</label><input class="clay-input" id="image_license" name="image_license" value="{{ old('image_license', $article->image_license) }}" maxlength="100"></div>
            </div>
            <div class="clay-actions"><button class="adm-btn adm-btn--primary" type="submit" style="min-height:48px;padding-inline:28px">Simpan perubahan</button></div>
        </form>
    </section>

    <details class="adm-card adm-danger">
        <summary>Hapus artikel permanen</summary>
        <p class="adm-muted">Artikel dan komentarnya dihapus. Backup JSON disimpan di server dulu. Kalau cuma ingin menurunkan, pakai <strong>Sembunyikan</strong>.</p>
        <form class="adm-form" method="POST" action="{{ route('panel.news.destroy', $article->id) }}" data-confirm="Hapus “{{ $article->title }}” secara permanen?" data-confirm-title="Hapus artikel" data-confirm-ok="Hapus permanen">
            @csrf
            @method('DELETE')
            <label for="confirm-del">Ketik <strong>HAPUS</strong> untuk konfirmasi</label>
            <input class="clay-input" id="confirm-del" name="confirm" autocomplete="off" required pattern="HAPUS">
            <div><button class="adm-btn adm-btn--danger" type="submit">Hapus artikel</button></div>
        </form>
    </details>
@endsection
