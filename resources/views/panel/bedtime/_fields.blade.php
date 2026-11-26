<label for="title">Judul</label>
<input class="clay-input" id="title" name="title" value="{{ old('title', $story?->title) }}" minlength="3" maxlength="160" required>

<label for="slug">Slug (opsional, otomatis dibuat dari judul bila kosong)</label>
<input class="clay-input" id="slug" name="slug" value="{{ old('slug', $story?->slug) }}" maxlength="160" placeholder="judul-cerita">

<div class="adm-form-grid">
    <div class="adm-form">
        <label for="author">Penulis Asli (wajib)</label>
        <input class="clay-input" id="author" name="author" value="{{ old('author', $story?->author) }}" minlength="2" maxlength="120" required placeholder="Aesop">
    </div>
    <div class="adm-form">
        <label for="author_origin">Asal / Era Penulis</label>
        <input class="clay-input" id="author_origin" name="author_origin" value="{{ old('author_origin', $story?->author_origin) }}" maxlength="120" placeholder="Yunani kuno">
    </div>
</div>

<div class="adm-form-grid">
    <div class="adm-form">
        <label for="adapter">Diceritakan Ulang Oleh</label>
        <input class="clay-input" id="adapter" name="adapter" value="{{ old('adapter', $story?->adapter ?? 'Dongeng Anak Kecil') }}" maxlength="120">
    </div>
    <div class="adm-form">
        <label for="language">Bahasa</label>
        <select class="clay-input" id="language" name="language">
            <option value="en" @selected(old('language', $story?->language ?? 'en') === 'en')>English (en)</option>
            <option value="id" @selected(old('language', $story?->language) === 'id')>Indonesia (id)</option>
        </select>
    </div>
</div>

<label for="summary">Ringkasan (opsional, diambil dari awal body bila kosong)</label>
<textarea class="clay-input" id="summary" name="summary" maxlength="300" rows="3">{{ old('summary', $story?->summary) }}</textarea>

<label for="body">Isi Cerita (paragraf teks polos dipisahkan baris kosong, tanpa HTML)</label>
<textarea class="clay-input adm-body-input" id="body" name="body" maxlength="20000" rows="12" required placeholder="Tulis isi cerita di sini. Pisahkan tiap paragraf dengan baris kosong.">{{ old('body', $story?->body) }}</textarea>

<label for="moral">Pesan Moral (opsional)</label>
<textarea class="clay-input" id="moral" name="moral" maxlength="2000" rows="2" placeholder="Pesan moral cerita...">{{ old('moral', $story?->moral) }}</textarea>
