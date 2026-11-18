<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\MemberPage;
use App\Models\MemberPageComment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Secret-authenticated moderation API for member pages and their comment walls. */
class CommunityController extends Controller
{
    public function pages(): JsonResponse
    {
        $items = MemberPage::query()->with('user:id,username')->orderByDesc('reports_count')->orderByDesc('id')->limit(200)->get()
            ->map(fn (MemberPage $p): array => ['id' => $p->id, 'username' => $p->user?->username, 'title' => $p->title, 'status' => $p->status, 'views' => $p->views, 'reports' => $p->reports_count]);

        return response()->json(['pages' => $items]);
    }

    public function updatePage(Request $request, int $page): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:published,hidden']]);
        $model = MemberPage::query()->findOrFail($page);
        $model->update(['status' => $data['status']] + ($data['status'] === 'published' ? ['reports_count' => 0] : []));

        return response()->json(['id' => $model->id, 'status' => $model->status]);
    }

    public function comments(Request $request): JsonResponse
    {
        $items = MemberPageComment::query()->with(['user:id,username', 'page.user:id,username'])
            ->when($request->boolean('reported'), fn ($q) => $q->where('reports_count', '>', 0))
            ->orderByDesc('id')->limit(200)->get()
            ->map(fn (MemberPageComment $c): array => ['id' => $c->id, 'page_owner' => $c->page?->user?->username, 'author' => $c->user?->username, 'body' => $c->body, 'hidden' => $c->is_hidden, 'reports' => $c->reports_count]);

        return response()->json(['comments' => $items]);
    }

    public function moderateComment(Request $request, int $comment): JsonResponse
    {
        $data = $request->validate(['is_hidden' => ['required', 'boolean']]);
        $model = MemberPageComment::query()->findOrFail($comment);
        $model->update(['is_hidden' => $data['is_hidden']]);

        return response()->json(['id' => $model->id, 'is_hidden' => $model->is_hidden]);
    }
}
