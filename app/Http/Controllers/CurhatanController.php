<?php

namespace App\Http\Controllers;

use App\Models\MemberPage;
use App\Models\MemberPost;
use App\Models\MemberPostComment;
use App\Models\User;
use App\Services\CurhatanFeed;
use App\Services\PostImage;
use App\Services\TenantPath;
use App\Support\BadWords;
use App\Support\Ga4;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Curhatan: short posts on member profiles. Visibility is enforced by MemberPost::visibleTo on every read
 * (lists, single post, image, like, comment, report); anything not visible is a plain 404.
 * Write endpoints are POST-only with session + CSRF and never carry public cache headers.
 */
class CurhatanController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user->isMember() && is_string($user->username) && $user->username !== '', 403);

        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:4000', 'required_without:image'],
            'visibility' => ['required', 'in:'.implode(',', array_keys(MemberPost::VISIBILITIES))],
            'image' => ['nullable', 'file', 'max:5120', 'mimetypes:image/jpeg,image/png,image/webp,image/gif'],
        ], [
            'body.required_without' => 'Tulis sesuatu atau pilih gambar dulu.',
            'image.max' => 'Ukuran gambar maksimal 5 MB.',
            'image.mimetypes' => 'Format gambar harus JPG, PNG, WebP, atau GIF.',
        ]);

        $body = self::cleanText((string) ($data['body'] ?? ''));
        if (mb_strlen($body) > MemberPost::MAX_CHARS) {
            throw ValidationException::withMessages(['body' => 'Maksimal '.MemberPost::MAX_CHARS.' karakter.']);
        }
        if ($body === '' && ! $request->hasFile('image')) {
            throw ValidationException::withMessages(['body' => 'Tulis sesuatu atau pilih gambar dulu.']);
        }
        if (preg_match_all('~https?://|www\.~i', $body) > 2) {
            throw ValidationException::withMessages(['body' => 'Maksimal dua tautan per curhatan.']);
        }

        $image = null;
        if ($request->hasFile('image')) {
            try {
                $image = PostImage::store($user->id, (string) file_get_contents($request->file('image')->getRealPath()));
            } catch (\InvalidArgumentException $e) {
                throw ValidationException::withMessages(['image' => $e->getMessage()]);
            }
        }

        // Posts only show while the author has a published page; make sure a fresh member has one.
        MemberPage::query()->firstOrCreate(['user_id' => $user->id], ['title' => 'Profil '.$user->name, 'html' => '', 'status' => 'published']);

        $post = MemberPost::query()->create([
            'user_id' => $user->id, 'body' => BadWords::clean($body), 'image' => $image, 'visibility' => $data['visibility'],
        ]);

        Ga4::flash('post_create', ['content_type' => 'curhatan', 'visibility' => $post->visibility, 'has_image' => $image !== null]);

        return redirect('/u/'.$user->username.'#curhat-'.$post->id)->with('status', 'Curhatan terkirim.');
    }

    public function destroy(Request $request, int $post): RedirectResponse
    {
        $model = MemberPost::query()->findOrFail($post);
        abort_unless($request->user()->id === $model->user_id, 404);
        PostImage::delete($model->user_id, $model->image);
        $model->delete();

        return redirect('/u/'.$request->user()->username.'#curhatan')->with('status', 'Curhatan dihapus.');
    }

    public function like(Request $request, int $post): JsonResponse|RedirectResponse
    {
        $model = $this->visible($request, $post);
        $userId = $request->user()->id;

        $liked = DB::transaction(function () use ($model, $userId): bool {
            $deleted = DB::table('member_post_likes')->where('member_post_id', $model->id)->where('user_id', $userId)->delete();
            if ($deleted === 0) {
                DB::table('member_post_likes')->insertOrIgnore(['member_post_id' => $model->id, 'user_id' => $userId, 'created_at' => now()]);
            }
            $count = DB::table('member_post_likes')->where('member_post_id', $model->id)->count();
            MemberPost::query()->whereKey($model->id)->update(['likes_count' => $count]);

            return $deleted === 0;
        });
        $count = (int) MemberPost::query()->whereKey($model->id)->value('likes_count');

        if ($request->expectsJson()) {
            return response()->json(['liked' => $liked, 'count' => $count], 200, ['Cache-Control' => 'no-store']);
        }
        if ($liked) {
            Ga4::flash('like', ['content_type' => 'curhatan']);
        }

        return $this->back($request, $model);
    }

    public function comment(Request $request, int $post): RedirectResponse
    {
        $model = $this->visible($request, $post);
        $data = $request->validate(['body' => ['required', 'string', 'max:2000']], ['body.required' => 'Komentar masih kosong.']);
        $body = self::cleanText($data['body']);

        if ($body === '' || mb_strlen($body) > MemberPostComment::MAX_CHARS) {
            throw ValidationException::withMessages(['body' => 'Komentar 1–'.MemberPostComment::MAX_CHARS.' karakter.']);
        }
        if (preg_match_all('~https?://|www\.~i', $body) > 1) {
            throw ValidationException::withMessages(['body' => 'Maksimal satu tautan per komentar.']);
        }

        MemberPostComment::query()->create(['member_post_id' => $model->id, 'user_id' => $request->user()->id, 'body' => BadWords::clean($body)]);
        $model->increment('comments_count');
        Ga4::flash('comment_post', ['content_type' => 'curhatan']);

        return $this->back($request, $model)->with('status', 'Komentar terkirim.');
    }

    /** The comment's author or the post owner may delete a comment. */
    public function destroyComment(Request $request, int $comment): RedirectResponse
    {
        $model = MemberPostComment::query()->with('post')->findOrFail($comment);
        $post = $model->post;
        abort_unless($post instanceof MemberPost, 404);
        abort_unless(in_array($request->user()->id, [$model->user_id, $post->user_id], true), 403);

        $model->delete();
        MemberPost::query()->whereKey($post->id)->update(['comments_count' => MemberPostComment::query()->where('member_post_id', $post->id)->where('is_hidden', false)->count()]);

        return $this->back($request, $post)->with('status', 'Komentar dihapus.');
    }

    public function report(Request $request, int $post): RedirectResponse
    {
        $model = $this->visible($request, $post);
        abort_if($model->user_id === $request->user()->id, 422);
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:300']]);

        $inserted = DB::table('member_post_reports')->insertOrIgnore([
            'member_post_id' => $model->id, 'user_id' => $request->user()->id, 'target' => 'p:'.$model->id,
            'reason' => $data['reason'] ?? null, 'created_at' => now(),
        ]);
        if ($inserted) {
            $model->increment('reports_count');
            if ($model->reports_count >= MemberPost::AUTO_HIDE_REPORTS) {
                $model->update(['is_hidden' => true]);
            }
        }

        return $this->back($request, $model)->with('status', 'Laporan diterima. Terima kasih, moderator akan meninjaunya.');
    }

    public function reportComment(Request $request, int $comment): RedirectResponse
    {
        $model = MemberPostComment::query()->findOrFail($comment);
        $post = $this->visible($request, $model->member_post_id);
        abort_if($model->user_id === $request->user()->id, 422);

        $inserted = DB::table('member_post_reports')->insertOrIgnore([
            'member_post_id' => $post->id, 'member_post_comment_id' => $model->id, 'user_id' => $request->user()->id,
            'target' => 'c:'.$model->id, 'reason' => null, 'created_at' => now(),
        ]);
        if ($inserted) {
            $model->increment('reports_count');
            if ($model->reports_count >= MemberPost::AUTO_HIDE_REPORTS) {
                $model->update(['is_hidden' => true]);
                $post->decrement('comments_count');
            }
        }

        return $this->back($request, $post)->with('status', 'Laporan diterima. Terima kasih.');
    }

    /** Single post page with all comments. Not visible (or not this author's) = 404, so private posts never leak. */
    public function show(Request $request, string $username, int $post): Response
    {
        $viewer = $request->user();
        $model = MemberPost::query()->with(['user:id,username,name', 'user.memberPage:id,user_id,config,html'])->findOrFail($post);
        abort_unless($model->user?->username === $username, 404);
        $isOwner = $viewer?->id === $model->user_id;
        abort_unless($isOwner || $model->isVisibleTo($viewer), 404);

        $extras = CurhatanFeed::extras(collect([$model]), $viewer, 200);

        return response()->view('clay.curhatan-post', [
            'metaTitle' => 'Curhatan '.CurhatanFeed::name($model->user).' (@'.$username.') — Jadidaring',
            'metaDescription' => mb_substr($model->body, 0, 150) ?: 'Curhatan member Jadidaring.',
            'canonicalUrl' => 'https://'.TenantPath::host().$model->url(),
            'noindex' => true,
            'post' => $model,
            'liked' => $extras['liked'],
            'previews' => $extras['previews'],
        ])->header('Cache-Control', 'private, no-store');
    }

    /** "Muat lagi" on a profile: the next page of that member's posts as an HTML fragment. */
    public function profileMore(Request $request, string $username): Response
    {
        $owner = User::query()->where('username', $username)->firstOrFail();
        $page = MemberPage::query()->where('user_id', $owner->id)->first();
        abort_unless($page && ($page->isPublished() || $request->user()?->id === $owner->id), 404);

        $feed = CurhatanFeed::profile($owner, $request->user(), (int) $request->query('sebelum', 0) ?: null);

        return response()->view('clay._curhat-list', $feed + CurhatanFeed::extras($feed['posts'], $request->user()) + [
            'moreUrl' => '/u/'.$owner->username.'/curhatan', 'showAuthor' => false,
        ])->header('Cache-Control', 'private, no-store');
    }

    /** Post image, served only to viewers who may see the post. Public posts may sit in shared caches briefly. */
    public function image(Request $request, int $post): BinaryFileResponse
    {
        $model = MemberPost::query()->findOrFail($post);
        $viewer = $request->user();
        abort_unless($model->image && ($viewer?->id === $model->user_id || $model->isVisibleTo($viewer)), 404);
        $path = PostImage::path($model->user_id, (string) $model->image);
        abort_if($path === null, 404);

        $public = $model->isPublic() && ! $model->is_hidden;
        $response = new BinaryFileResponse($path, 200, [
            'Content-Type' => 'image/webp',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
            'Vary' => 'Cookie',
        ], $public);
        $public ? $response->headers->set('Cache-Control', 'public, max-age=300, s-maxage=300') : $response->headers->set('Cache-Control', 'private, no-store');
        $response->setAutoEtag();
        $response->isNotModified($request);

        return $response;
    }

    private function visible(Request $request, int $post): MemberPost
    {
        $model = MemberPost::query()->with('user:id,username')->findOrFail($post);
        abort_unless($model->isVisibleTo($request->user()), 404);

        return $model;
    }

    /** Back to the page the action came from (same host only), at the post. */
    private function back(Request $request, MemberPost $post): RedirectResponse
    {
        $prev = (string) $request->headers->get('referer', '');
        $host = parse_url($prev, PHP_URL_HOST);
        $target = $host === $request->getHost() ? strtok($prev, '#') : $post->url();

        return redirect($target.'#curhat-'.$post->id);
    }

    /** Trims, normalises newlines, drops control characters and collapses long blank runs. */
    public static function cleanText(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = (string) preg_replace('/[^\P{C}\n]/u', '', $text);
        $text = (string) preg_replace("/\n{3,}/", "\n\n", $text);

        return trim($text);
    }
}
