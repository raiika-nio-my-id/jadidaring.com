{{-- Owner's post box on their own profile. --}}
<form class="ch-composer" method="post" action="/curhatan" enctype="multipart/form-data" data-ch-composer>
    @csrf
    <label class="sr-only" for="ch-body">Lagi mikirin apa?</label>
    <textarea class="clay-input ch-composer__text" id="ch-body" name="body" rows="2" maxlength="{{ \App\Models\MemberPost::MAX_CHARS }}" placeholder="Lagi mikirin apa?" data-ch-text>{{ old('body') }}</textarea>
    <div class="ch-composer__preview" data-ch-preview hidden>
        <img alt="Pratinjau gambar" data-ch-preview-img>
        <button type="button" class="ch-composer__rm" data-ch-rm aria-label="Hapus gambar">×</button>
    </div>
    @if ($errors->has('body') || $errors->has('image') || $errors->has('visibility'))
        <p class="news-comments__msg" role="alert">{{ $errors->first('body') ?: ($errors->first('image') ?: $errors->first('visibility')) }}</p>
    @endif
    <div class="ch-composer__bar">
        <label class="ch-pick" title="Tambah foto">
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif" data-ch-file>
            <span aria-hidden="true">📷</span> Foto
        </label>
        <label class="sr-only" for="ch-vis">Siapa yang bisa melihat</label>
        <select class="clay-input ch-vis-select" id="ch-vis" name="visibility">
            @foreach (\App\Models\MemberPost::VISIBILITIES as $v => $label)
                <option value="{{ $v }}" @selected(old('visibility', 'public') === $v)>{{ ['public' => '🌐', 'followers' => '👥', 'private' => '🔒'][$v] }} {{ $label }}</option>
            @endforeach
        </select>
        <span class="ch-count" data-ch-counter aria-live="polite">0/{{ \App\Models\MemberPost::MAX_CHARS }}</span>
        <button class="clay-btn clay-btn--primary ch-send" type="submit">Kirim</button>
    </div>
</form>
