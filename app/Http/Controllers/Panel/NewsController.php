<?php

namespace App\Http\Controllers\Panel;

use App\Http\Controllers\ClayController;
use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\ArticleComment;
use App\Models\NewsTopic;
use App\Services\Admin\AdminAudit;
use App\Services\Admin\AdminBackup;
use App\Services\NewsCache;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/** /admin Berita: list, search, filter, edit, hide/unhide, delete (with JSON backup), topics, comment moderation. */
class NewsController extends Controller
{
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

    public function toggleComment(Request $request, int $comment): RedirectResponse
    {
        $model = ArticleComment::query()->findOrFail($comment);
        $model->update(['is_hidden' => ! $model->is_hidden]);
        AdminAudit::log($request, $model->is_hidden ? 'news.comment.hide' : 'news.comment.unhide', 'article_comment', $model->id, Str::limit((string) $model->body, 80));

        return back()->with('toast', $model->is_hidden ? 'Komentar disembunyikan.' : 'Komentar tampil lagi.');
    }

    public function destroyComment(Request $request, int $comment): RedirectResponse
    {
        $model = ArticleComment::query()->findOrFail($comment);
        $file = AdminBackup::write('article-comment-'.$model->id, $model->toArray());
        $model->delete();
        AdminAudit::log($request, 'news.comment.delete', 'article_comment', $comment, Str::limit((string) $model->body, 80), ['backup' => basename($file)]);

        return back()->with('toast', 'Komentar dihapus.');
    }
}
