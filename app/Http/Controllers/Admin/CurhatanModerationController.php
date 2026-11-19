<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MemberPost;
use App\Models\MemberPostComment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/** Admin moderation for Curhatan: reported / hidden / latest posts and reported comments, with hide and unhide. */
class CurhatanModerationController extends Controller
{
    public function index(Request $request): View
    {
        $filter = in_array($request->query('f'), ['dilaporkan', 'disembunyikan', 'terbaru'], true) ? $request->query('f') : 'dilaporkan';

        $posts = MemberPost::query()->with('user:id,username,name')
            ->when($filter === 'dilaporkan', fn ($q) => $q->where('reports_count', '>', 0)->orderByDesc('reports_count'))
            ->when($filter === 'disembunyikan', fn ($q) => $q->where('is_hidden', true))
            ->orderByDesc('id')->paginate(30)->withQueryString();

        $comments = MemberPostComment::query()->with(['user:id,username', 'post:id,user_id'])
            ->where('reports_count', '>', 0)->orWhere('is_hidden', true)->orderByDesc('reports_count')->orderByDesc('id')->limit(50)->get();

        return view('admin.curhatan', ['posts' => $posts, 'comments' => $comments, 'filter' => $filter]);
    }

    public function togglePost(MemberPost $post): RedirectResponse
    {
        $post->update(['is_hidden' => ! $post->is_hidden, 'reports_count' => $post->is_hidden ? 0 : $post->reports_count]);

        return back()->with('status', $post->is_hidden ? 'Curhatan disembunyikan.' : 'Curhatan ditampilkan lagi (laporan direset).');
    }

    public function toggleComment(MemberPostComment $comment): RedirectResponse
    {
        $comment->update(['is_hidden' => ! $comment->is_hidden, 'reports_count' => $comment->is_hidden ? 0 : $comment->reports_count]);
        MemberPost::query()->whereKey($comment->member_post_id)->update([
            'comments_count' => MemberPostComment::query()->where('member_post_id', $comment->member_post_id)->where('is_hidden', false)->count(),
        ]);

        return back()->with('status', $comment->is_hidden ? 'Komentar disembunyikan.' : 'Komentar ditampilkan lagi.');
    }
}
