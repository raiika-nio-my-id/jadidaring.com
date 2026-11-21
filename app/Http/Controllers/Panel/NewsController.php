<?php

namespace App\Http\Controllers\Panel;

use App\Http\Controllers\ClayController;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Panel\Concerns\RespondsToModeration;
use App\Models\Article;
use App\Models\ArticleComment;
use App\Models\NewsTopic;
use App\Services\Admin\AdminAudit;
use App\Services\Admin\AdminBackup;
use App\Services\NewsCache;
use App\Services\NewsImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/** /admin Berita: list, search, filter, edit, hide/unhide, delete (with JSON backup), topics, comment moderation. */
class NewsController extends Controller
{
    use RespondsToModeration;

    public function index(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));
        $topic = (string) $request->query('topik', '');
        $status = (string) $request->query('status', '');

        $articles = Article::query()
            ->withCount('comments')
            ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x->where('title', 'like', '%'.$q.'%')->orWhere('slug', 'like', '%'.$q.'%')))
            ->when(array_key_exists($topic, ClayController::TOPICS), fn ($w) => $w->where('topic', $topic))
            ->when(in_array($status, Article::STATUSES, true), fn ($w) => $w->where('status', $status))
            ->orderByDesc('id')
            ->paginate(20, ['id', 'topic', 'slug', 'title', 'status', 'published_at', 'created_at', 'image_path'])
            ->withQueryString();

        return view('panel.news.index', [
            'articles' => $articles, 'q' => $q, 'topic' => $topic, 'status' => $status,
            'topics' => ClayController::TOPICS,
            'statusCounts' => Article::query()->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status'),
        ]);
    }

    /** Free licences only; an empty photo means the branded title card is drawn as usual. */
    public const LICENSES = ['CC0', 'Domain publik', 'CC BY 4.0', 'CC BY-SA 4.0', 'Unsplash License', 'Pexels License', 'Pixabay License', 'Foto sendiri (Jadidaring)'];

    public function create(): View
    {
        return view('panel.news.create', ['topics' => ClayController::TOPICS, 'licenses' => self::LICENSES]);
    }

    public function store(Request $request): RedirectResponse
    {
        // "Judul | https://..." or just "https://..." per line -> the same sources array the API takes
        $sources = collect(preg_split('/\R/', (string) $request->input('sources_text', '')) ?: [])
            ->map(fn ($l) => trim($l))->filter()
            ->map(function (string $l): array {
                $parts = array_map('trim', explode('|', $l, 2));

                return count($parts) === 2 ? ['title' => $parts[0], 'url' => $parts[1]] : ['url' => $parts[0]];
            })->values()->all();
        $request->merge(['sources' => $sources]);

        $own = $request->input('image_license') === 'Foto sendiri (Jadidaring)';
        $data = $request->validate(\App\Services\NewsArticleCreator::rules() + [
            'status' => ['required', Rule::in(['draft', 'published'])],
            'sources.*.url' => ['required', 'url:https', 'max:500'],
            'sources.*.title' => ['nullable', 'string', 'max:150'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:12288', 'dimensions:min_width=1200,min_height=630'],
            'image_alt' => ['required_with:image', 'nullable', 'string', 'min:5', 'max:200'],
            'image_credit' => ['required_with:image', 'nullable', 'string', 'min:2', 'max:200'],
            'image_license' => ['required_with:image', 'nullable', Rule::in(self::LICENSES)],
            'image_source_url' => [$own ? 'nullable' : 'required_with:image', 'nullable', 'url:https', 'max:500'],
        ], [
            'sources.min' => 'Butuh minimal 2 sumber (satu URL per baris).',
            'sources.required' => 'Butuh minimal 2 sumber (satu URL per baris).',
            'sources.*.url.url' => 'Setiap sumber harus URL https.',
            'image.dimensions' => 'Foto minimal 1200×630 px.',
            'image_license.in' => 'Hanya foto berlisensi bebas yang boleh dipakai.',
        ], ['title' => 'judul', 'summary' => 'ringkasan', 'body' => 'isi', 'sources' => 'sumber', 'image' => 'foto', 'image_alt' => 'teks alt', 'image_credit' => 'kredit foto', 'image_license' => 'lisensi', 'image_source_url' => 'URL sumber foto']);

        $article = \App\Services\NewsArticleCreator::create($data);
        $toast = $article->status === 'published' ? 'Berita terbit.' : 'Draf berita disimpan.';

        if ($request->hasFile('image')) {
            try {
                NewsImage::storePhoto($article, (string) file_get_contents($request->file('image')->getRealPath()), [
                    'alt' => $data['image_alt'], 'credit' => $data['image_credit'], 'license' => $data['image_license'],
                    'source_url' => $data['image_source_url'] ?? null,
                ]);
                NewsCache::bump();
            } catch (\InvalidArgumentException $e) {
                return redirect()->route('panel.news.edit', $article->id)->with('toast_error', 'Berita disimpan, tapi foto gagal: '.$e->getMessage().' Kartu judul otomatis dipakai.');
            }
        }

        AdminAudit::log($request, 'news.create', 'article', $article->id, $article->title, ['status' => $article->status]);

        return redirect()->route('panel.news.edit', $article->id)->with('toast', $toast);
    }

    public function edit(int $article): View
    {
        $model = Article::query()->withCount('comments')->findOrFail($article);

        return view('panel.news.edit', ['article' => $model, 'topics' => ClayController::TOPICS]);
    }

    public function update(Request $request, int $article): RedirectResponse
    {
        $model = Article::query()->findOrFail($article);

        $data = $request->validate([
            'title' => ['required', 'string', 'min:10', 'max:200'],
            'summary' => ['required', 'string', 'min:20', 'max:400'],
            'body' => ['required', 'string', 'min:200', 'max:60000'],
            'topic' => ['required', 'string', Rule::in(array_keys(ClayController::TOPICS))],
            'image_alt' => ['nullable', 'string', 'max:200'],
            'image_credit' => ['nullable', 'string', 'max:200'],
            'image_source_url' => ['nullable', 'url:https', 'max:500'],
            'image_license' => ['nullable', 'string', 'max:100'],
        ]);

        $model->fill($data);
        $changed = array_keys($model->getDirty());
        $model->save();
        NewsCache::bump();
        AdminAudit::log($request, 'news.update', 'article', $model->id, $model->title, ['fields' => $changed]);

        return redirect()->route('panel.news.edit', $model->id)->with('toast', $changed === [] ? 'Tidak ada perubahan.' : 'Artikel disimpan.');
    }

    public function status(Request $request, int $article): RedirectResponse
    {
        $model = Article::query()->findOrFail($article);
        $data = $request->validate(['status' => ['required', Rule::in(['published', 'hidden'])]]);
        $before = $model->status;

        if ($data['status'] === 'published') {
            $model->published_at ??= now();
        }

        $model->status = $data['status'];
        $model->save();
        NewsCache::bump();
        AdminAudit::log($request, $data['status'] === 'hidden' ? 'news.hide' : 'news.unhide', 'article', $model->id, $model->title, ['from' => $before]);

        return back()->with('toast', $data['status'] === 'hidden' ? 'Artikel disembunyikan dari situs.' : 'Artikel tampil lagi di situs.');
    }

    public function destroy(Request $request, int $article): RedirectResponse
    {
        $model = Article::query()->findOrFail($article);
        $request->validate(['confirm' => ['required', 'in:HAPUS']], ['confirm.in' => 'Ketik HAPUS untuk konfirmasi.']);

        $file = AdminBackup::write('article-'.$model->id, ['article' => $model->toArray(), 'comments' => $model->comments()->get()->toArray()]);
        $title = $model->title;
        $model->delete();
        NewsCache::bump();
        AdminAudit::log($request, 'news.delete', 'article', $article, $title, ['backup' => basename($file)]);

        return redirect()->route('panel.news')->with('toast', 'Artikel dihapus. Backup: '.basename($file));
    }

    public function topics(): View
    {
        $counts = Article::query()->selectRaw('topic, count(*) as n')->groupBy('topic')->pluck('n', 'topic');

        return view('panel.news.topics', ['topics' => NewsTopic::query()->orderBy('slug')->get(), 'counts' => $counts]);
    }

    public function updateTopic(Request $request, string $slug): RedirectResponse
    {
        $topic = NewsTopic::query()->findOrFail($slug);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:64'],
            'enabled' => ['sometimes', 'boolean'],
            'articles_per_day' => ['required', 'integer', 'min:0', 'max:50'],
            'min_sources' => ['required', 'integer', 'min:2', 'max:10'],
        ]);
        $data['enabled'] = $request->boolean('enabled');
        $topic->update($data);
        NewsCache::bump();
        AdminAudit::log($request, 'news.topic.update', 'topic', $slug, $topic->name, $data);

        return back()->with('toast', 'Topik '.$topic->name.' disimpan.');
    }

    public function comments(Request $request): View
    {
        $f = in_array($request->query('f'), ['semua', 'disembunyikan'], true) ? $request->query('f') : 'semua';
        $q = trim((string) $request->query('q', ''));

        $comments = ArticleComment::query()->with(['user:id,username,name', 'article:id,topic,slug,title'])
            ->when($f === 'disembunyikan', fn ($w) => $w->where('is_hidden', true))
            ->when($q !== '', fn ($w) => $w->where('body', 'like', '%'.$q.'%'))
            ->orderByDesc('id')->paginate(30)->withQueryString();

        return view('panel.news.comments', ['comments' => $comments, 'f' => $f, 'q' => $q]);
    }

    public function toggleComment(Request $request, int $comment): JsonResponse|RedirectResponse
    {
        $model = ArticleComment::query()->findOrFail($comment);
        $model->update(['is_hidden' => $this->wantHidden($request, (bool) $model->is_hidden)]);
        AdminAudit::log($request, $model->is_hidden ? 'news.comment.hide' : 'news.comment.unhide', 'article_comment', $model->id, Str::limit((string) $model->body, 80));

        return $this->moderated($request, $model->is_hidden ? 'Komentar disembunyikan.' : 'Komentar tampil lagi.', ['hidden' => (bool) $model->is_hidden]);
    }

    public function destroyComment(Request $request, int $comment): JsonResponse|RedirectResponse
    {
        $model = ArticleComment::query()->findOrFail($comment);
        $file = AdminBackup::write('article-comment-'.$model->id, $model->toArray());
        $model->delete();
        AdminAudit::log($request, 'news.comment.delete', 'article_comment', $comment, Str::limit((string) $model->body, 80), ['backup' => basename($file)]);

        return $this->moderated($request, 'Komentar dihapus.', ['deleted' => true]);
    }
}
