<?php

namespace App\Http\Controllers\Panel;

use App\Http\Controllers\Controller;
use App\Models\MemberPage;
use App\Models\MemberPageComment;
use App\Models\MemberPost;
use App\Models\MemberPostComment;
use App\Services\Admin\AdminAudit;
use App\Services\Admin\AdminBackup;
use App\Services\PostImage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\View\View;

/**
 * /admin Komunitas: member profiles (hide/unhide, reset visitor count), comment-wall moderation
 * and Curhatan moderation (same hide/unhide rules as the old admin.jadidaring.com Curhatan page, plus delete with backup).
 */
class CommunityController extends Controller
{
    public function index(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));
        $status = in_array($request->query('status'), ['published', 'hidden', 'dilaporkan'], true) ? (string) $request->query('status') : '';

        $pages = MemberPage::query()->with('user:id,username,name,banned_at')
            ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x->where('title', 'like', '%'.$q.'%')
                ->orWhereHas('user', fn ($u) => $u->where('username', 'like', '%'.$q.'%')->orWhere('name', 'like', '%'.$q.'%'))))
            ->when(in_array($status, ['published', 'hidden'], true), fn ($w) => $w->where('status', $status))
            ->when($status === 'dilaporkan', fn ($w) => $w->where('reports_count', '>', 0)->orderByDesc('reports_count'))
            ->orderByDesc('updated_at')->orderByDesc('id')
            ->paginate(20, ['id', 'user_id', 'title', 'status', 'views', 'reports_count', 'created_at', 'updated_at'])->withQueryString();

        return view('panel.community.index', ['pages' => $pages, 'q' => $q, 'status' => $status]);
    }

    public function show(int $page): View
    {
        $model = MemberPage::query()->with('user')->findOrFail($page);

        return view('panel.community.show', [
            'page' => $model,
            'comments' => MemberPageComment::query()->with('user:id,username')->where('member_page_id', $model->id)->orderByDesc('id')->limit(50)->get(),
            'posts' => MemberPost::query()->where('user_id', $model->user_id)->orderByDesc('id')->limit(20)->get(),
            'visitors' => DB::table('member_page_visitors')->where('member_page_id', $model->id)->count(),
        ]);
    }

    public function status(Request $request, int $page): RedirectResponse
    {
        $model = MemberPage::query()->with('user:id,username')->findOrFail($page);
        $data = $request->validate(['status' => ['required', 'in:published,hidden']]);
        // Same rule as the admin API: re-publishing clears the report count.
        $model->update(['status' => $data['status']] + ($data['status'] === 'published' ? ['reports_count' => 0] : []));
        AdminAudit::log($request, $data['status'] === 'hidden' ? 'community.page.hide' : 'community.page.unhide', 'member_page', $model->id, '@'.$model->user?->username);

        return back()->with('toast', $data['status'] === 'hidden' ? 'Profil disembunyikan dari publik.' : 'Profil tampil lagi (laporan direset).');
    }

    public function resetViews(Request $request, int $page): RedirectResponse
    {
        $model = MemberPage::query()->with('user:id,username')->findOrFail($page);
        $before = (int) $model->views;
        DB::transaction(function () use ($model): void {
            DB::table('member_page_visitors')->where('member_page_id', $model->id)->delete();
            $model->forceFill(['views' => 0])->save();
        });
        AdminAudit::log($request, 'community.page.reset_views', 'member_page', $model->id, '@'.$model->user?->username, ['before' => $before]);

        return back()->with('toast', 'Hitungan pengunjung direset ke 0.');
    }

    public function comments(Request $request): View
    {
        $f = in_array($request->query('f'), ['semua', 'dilaporkan', 'disembunyikan'], true) ? (string) $request->query('f') : 'semua';
        $q = trim((string) $request->query('q', ''));

        $comments = MemberPageComment::query()->with(['user:id,username', 'page:id,user_id', 'page.user:id,username'])
            ->when($f === 'dilaporkan', fn ($w) => $w->where('reports_count', '>', 0)->orderByDesc('reports_count'))
            ->when($f === 'disembunyikan', fn ($w) => $w->where('is_hidden', true))
            ->when($q !== '', fn ($w) => $w->where('body', 'like', '%'.$q.'%'))
            ->orderByDesc('id')->paginate(30)->withQueryString();

        return view('panel.community.comments', ['comments' => $comments, 'f' => $f, 'q' => $q]);
    }

    public function toggleComment(Request $request, int $comment): RedirectResponse
    {
        $model = MemberPageComment::query()->findOrFail($comment);
        $model->update(['is_hidden' => ! $model->is_hidden, 'reports_count' => $model->is_hidden ? 0 : $model->reports_count]);
        AdminAudit::log($request, $model->is_hidden ? 'community.comment.hide' : 'community.comment.unhide', 'member_page_comment', $model->id, Str::limit((string) $model->body, 80));

        return back()->with('toast', $model->is_hidden ? 'Komentar disembunyikan.' : 'Komentar tampil lagi (laporan direset).');
    }

    public function destroyComment(Request $request, int $comment): RedirectResponse
    {
        $model = MemberPageComment::query()->findOrFail($comment);
        $file = AdminBackup::write('member-page-comment-'.$model->id, $model->toArray());
        $model->delete();
        AdminAudit::log($request, 'community.comment.delete', 'member_page_comment', $comment, Str::limit((string) $model->body, 80), ['backup' => basename($file)]);

        return back()->with('toast', 'Komentar dihapus.');
    }

    public function posts(Request $request): View
    {
        $f = in_array($request->query('f'), ['dilaporkan', 'disembunyikan', 'terbaru'], true) ? (string) $request->query('f') : 'terbaru';
        $q = trim((string) $request->query('q', ''));

        $posts = MemberPost::query()->with('user:id,username,name')
            ->when($f === 'dilaporkan', fn ($w) => $w->where('reports_count', '>', 0)->orderByDesc('reports_count'))
            ->when($f === 'disembunyikan', fn ($w) => $w->where('is_hidden', true))
            ->when($q !== '', fn ($w) => $w->where('body', 'like', '%'.$q.'%'))
            ->orderByDesc('id')->paginate(20)->withQueryString();

        $postComments = MemberPostComment::query()->with(['user:id,username', 'post:id,user_id'])
            ->where(fn ($w) => $w->where('reports_count', '>', 0)->orWhere('is_hidden', true))
            ->orderByDesc('reports_count')->orderByDesc('id')->limit(30)->get();

        return view('panel.community.posts', ['posts' => $posts, 'postComments' => $postComments, 'f' => $f, 'q' => $q]);
    }

    public function togglePost(Request $request, int $post): RedirectResponse
    {
        $model = MemberPost::query()->findOrFail($post);
        $model->update(['is_hidden' => ! $model->is_hidden, 'reports_count' => $model->is_hidden ? 0 : $model->reports_count]);
        AdminAudit::log($request, $model->is_hidden ? 'curhatan.hide' : 'curhatan.unhide', 'member_post', $model->id, Str::limit((string) $model->body, 80));

        return back()->with('toast', $model->is_hidden ? 'Curhatan disembunyikan.' : 'Curhatan tampil lagi (laporan direset).');
    }

    public function destroyPost(Request $request, int $post): RedirectResponse
    {
        $model = MemberPost::query()->findOrFail($post);
        $file = AdminBackup::write('member-post-'.$model->id, ['post' => $model->toArray(), 'comments' => $model->comments()->get()->toArray()]);

        if ($model->image) {
            PostImage::delete($model->user_id, $model->image);
        }

        $model->delete();
        AdminAudit::log($request, 'curhatan.delete', 'member_post', $post, Str::limit((string) $model->body, 80), ['backup' => basename($file)]);

        return back()->with('toast', 'Curhatan dihapus.');
    }

    public function togglePostComment(Request $request, int $comment): RedirectResponse
    {
        $model = MemberPostComment::query()->findOrFail($comment);
        $model->update(['is_hidden' => ! $model->is_hidden, 'reports_count' => $model->is_hidden ? 0 : $model->reports_count]);
        MemberPost::query()->whereKey($model->member_post_id)->update([
            'comments_count' => MemberPostComment::query()->where('member_post_id', $model->member_post_id)->where('is_hidden', false)->count(),
        ]);
        AdminAudit::log($request, $model->is_hidden ? 'curhatan.comment.hide' : 'curhatan.comment.unhide', 'member_post_comment', $model->id, Str::limit((string) $model->body, 80));

        return back()->with('toast', $model->is_hidden ? 'Komentar disembunyikan.' : 'Komentar tampil lagi.');
    }
}
