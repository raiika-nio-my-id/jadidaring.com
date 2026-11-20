            <label for="title">Judul</label>
            <input class="clay-input" id="title" name="title" value="{{ old('title', $article?->title) }}" minlength="10" maxlength="200" required>
            <label for="topic">Topik</label>
            <select class="clay-input" id="topic" name="topic">
                @foreach ($topics as $slug => $name)<option value="{{ $slug }}" @selected(old('topic', $article?->topic) === $slug)>{{ $name }}</option>@endforeach
            </select>
            @if ($article)<p class="adm-muted">Ganti topik mengubah alamat artikel; alamat lama otomatis dialihkan (301).</p>@endif
            <label for="summary">Ringkasan</label>
            <textarea class="clay-input" id="summary" name="summary" minlength="20" maxlength="400" required>{{ old('summary', $article?->summary) }}</textarea>
            <label for="body">Isi</label>
            <div class="adm-sub adm-mdbar" role="toolbar" aria-label="Format isi" data-md-for="body">
                <button class="adm-chip" type="button" data-md="h2">## Subjudul</button>
                <button class="adm-chip" type="button" data-md="bold"><strong>B</strong> Tebal</button>
                <button class="adm-chip" type="button" data-md="list">• Daftar</button>
                <button class="adm-chip" type="button" data-md="keypoints">📌 Poin penting</button>
            </div>
            <p class="adm-muted" style="margin:0">“## ” di awal baris = subjudul, **teks** = tebal, baris “- ” = daftar, “Poin penting” lalu baris “- ” = kotak poin penting. Pisahkan paragraf dengan baris kosong.</p>
            <textarea class="clay-input adm-body-input" id="body" name="body" minlength="200" maxlength="60000" required>{{ old('body', $article?->body) }}</textarea>
            <script>
            (function () {
                var bar = document.querySelector('[data-md-for]'); if (!bar) return;
                var ta = document.getElementById(bar.getAttribute('data-md-for'));
                bar.addEventListener('click', function (e) {
                    var b = e.target.closest('[data-md]'); if (!b || !ta) return;
                    var s = ta.selectionStart, en = ta.selectionEnd, v = ta.value, sel = v.slice(s, en), ins;
                    var lineStart = s === 0 || v[s - 1] === '\n' ? '' : '\n\n';
                    switch (b.getAttribute('data-md')) {
                        case 'bold': ins = '**' + (sel || 'teks tebal') + '**'; break;
                        case 'h2': ins = lineStart + '## ' + (sel || 'Subjudul') + '\n\n'; break;
                        case 'list': ins = lineStart + (sel ? sel.split('\n').map(function (l) { return '- ' + l; }).join('\n') : '- poin') + '\n\n'; break;
                        default: ins = lineStart + 'Poin penting\n- poin pertama\n- poin kedua\n\n';
                    }
                    ta.setRangeText(ins, s, en, 'end'); ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true }));
                });
            })();
            </script>
