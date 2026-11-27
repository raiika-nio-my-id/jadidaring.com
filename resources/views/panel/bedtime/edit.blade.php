@extends('panel.layout')
@php $panelTitle = 'Edit cerita'; @endphp

@section('panel')
    <section class="adm-card">
        <div class="adm-top">
            <div>
                <h2 style="margin:0">{{ $story->title }}</h2>
                <p class="adm-row__meta">@include('panel._status', ['s' => $story->status]) #{{ $story->id }} · {{ $story->slug }} · oleh {{ $story->author }} · diperbarui {{ $story->updated_at?->wita() }}</p>
            </div>
            <div class="adm-row__tools">
                @if ($story->status === 'published' && ! $story->published_at?->isFuture())
                    <a class="adm-btn" href="{{ $story->url() }}" target="_blank" rel="noopener" data-no-skel>Lihat di situs ↗</a>
                @endif
                <form method="POST" action="{{ route('panel.bedtime.status', $story->id) }}">
                    @csrf
                    <input type="hidden" name="status" value="{{ $story->status === 'published' ? 'draft' : 'published' }}">
                    <button class="adm-btn {{ $story->status === 'published' ? 'adm-btn--peach' : 'adm-btn--mint' }}" type="submit">
                        {{ $story->status === 'published' ? 'Jadikan draft' : 'Terbitkan' }}
                    </button>
                </form>
            </div>
        </div>

        <form class="adm-form" method="POST" action="{{ route('panel.bedtime.update', $story->id) }}" enctype="multipart/form-data">
            @csrf
            @method('PUT')
            @include('panel.bedtime._fields', ['story' => $story])

            <h3 style="margin-top:10px">Foto</h3>
            @if ($story->image_path)
                <img src="{{ \App\Services\BedtimeImage::src($story->id, 480, ($story->image_updated_at ?? $story->updated_at)?->timestamp) }}" alt="" style="max-width:320px;width:100%;border-radius:14px" loading="lazy">
            @else
                <p class="adm-muted">Cerita ini menggunakan kartu judul otomatis.</p>
            @endif

            <div class="adm-form">
                <label for="image">Ganti foto (upload file)</label>
                <input class="clay-input" type="file" id="image" name="image" accept="image/jpeg,image/png,image/webp">
            </div>

            <div class="adm-form">
                <label for="image_url">Atau URL gambar baru (https)</label>
                <input class="clay-input" id="image_url" name="image_url" type="url" value="{{ old('image_url') }}" maxlength="500">
            </div>

            <div class="adm-form-grid">
                <div class="adm-form"><label for="image_alt">Teks alt</label><input class="clay-input" id="image_alt" name="image_alt" value="{{ old('image_alt', $story->image_alt) }}" maxlength="200"></div>
                <div class="adm-form"><label for="image_credit">Kredit foto</label><input class="clay-input" id="image_credit" name="image_credit" value="{{ old('image_credit', $story->image_credit) }}" maxlength="200"></div>
                <div class="adm-form"><label for="image_license">Lisensi</label><input class="clay-input" id="image_license" name="image_license" value="{{ old('image_license', $story->image_license) }}" maxlength="100"></div>
                <div class="adm-form"><label for="image_source_url">URL sumber</label><input class="clay-input" id="image_source_url" name="image_source_url" type="url" value="{{ old('image_source_url', $story->image_source_url) }}" maxlength="500"></div>
            </div>

            <fieldset class="adm-fieldset">
                <legend>Status</legend>
                <div class="adm-sub">
                    <label class="adm-chip adm-radio"><input type="radio" name="status" value="draft" @checked(old('status', $story->status) === 'draft')> Draft</label>
                    <label class="adm-chip adm-radio"><input type="radio" name="status" value="published" @checked(old('status', $story->status) === 'published')> Terbit</label>
                </div>
            </fieldset>

            <div class="adm-form">
                <label for="published_at">Waktu Terbit (WITA)</label>
                <input class="clay-input" type="datetime-local" id="published_at" name="published_at" value="{{ old('published_at', $story->published_at?->copy()->setTimezone(\App\Models\BedtimeStory::INPUT_TIMEZONE)->format('Y-m-d\TH:i')) }}">
            </div>

            <div class="clay-actions"><button class="adm-btn adm-btn--primary" type="submit" style="min-height:48px;padding-inline:28px">Simpan perubahan</button></div>
        </form>
    </section>

    <details class="adm-card adm-danger" style="margin-top:20px">
        <summary>Hapus cerita permanen</summary>
        <p class="adm-muted">Cerita ini akan dihapus secara permanen. Backup JSON disimpan di server terlebih dahulu.</p>
        <form class="adm-form" method="POST" action="{{ route('panel.bedtime.destroy', $story->id) }}" data-confirm="Hapus “{{ $story->title }}” secara permanen?" data-confirm-title="Hapus cerita" data-confirm-ok="Hapus permanen">
            @csrf
            @method('DELETE')
            <label for="confirm-del">Ketik <strong>HAPUS</strong> untuk konfirmasi</label>
            <input class="clay-input" id="confirm-del" name="confirm" autocomplete="off" required pattern="HAPUS">
            <div><button class="adm-btn adm-btn--danger" type="submit">Hapus cerita</button></div>
        </form>
    </details>
@endsection
