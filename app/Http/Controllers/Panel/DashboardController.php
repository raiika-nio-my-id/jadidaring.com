<?php

namespace App\Http\Controllers\Panel;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\Article;
use App\Models\ArticleComment;
use App\Models\CompanyProfile;
use App\Models\ContactMessage;
use App\Models\MemberPage;
use App\Models\MemberPageComment;
use App\Models\MemberPost;
use App\Models\MemberPostComment;
use App\Models\User;
use App\Services\Admin\AdminAudit;
use App\Services\GoogleStats\GoogleStats;
use App\Services\GoogleStats\GoogleStatsException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\View\View;

/** /admin Ringkasan (counts, recent activity, GA chart) and the full Statistik page (GA4 + Search Console, ported from admin.jadidaring.com). */
class DashboardController extends Controller
{
    public function index(): View
    {
        $counts = [
            ['label' => 'User', 'value' => User::query()->count(), 'href' => route('panel.users'), 'tone' => 'lavender'],
            ['label' => 'User baru 7 hari', 'value' => User::query()->where('created_at', '>=', now()->subDays(7))->count(), 'href' => route('panel.users', ['sort' => 'baru']), 'tone' => 'mint'],
            ['label' => 'Artikel terbit', 'value' => Article::query()->where('status', 'published')->count(), 'href' => route('panel.news'), 'tone' => 'sky', 'sub' => Article::query()->count().' total'],
            ['label' => 'Profil komunitas', 'value' => MemberPage::query()->where('status', 'published')->count(), 'href' => route('panel.community'), 'tone' => 'peach', 'sub' => MemberPage::query()->count().' total'],
            ['label' => 'Curhatan', 'value' => MemberPost::query()->count(), 'href' => route('panel.community.posts'), 'tone' => 'pink'],
            ['label' => 'Komentar', 'value' => ArticleComment::query()->count() + MemberPageComment::query()->count() + MemberPostComment::query()->count(), 'href' => route('panel.news.comments'), 'tone' => 'lavender'],
            ['label' => 'Game', 'value' => CompanyProfile::query()->games()->count(), 'href' => route('panel.games'), 'tone' => 'mint'],
            ['label' => 'Pesan belum dibaca', 'value' => ContactMessage::query()->whereNull('read_at')->count(), 'href' => route('panel.messages'), 'tone' => 'sky'],
        ];

        $reported = [
            'curhatan' => MemberPost::query()->where('reports_count', '>', 0)->where('is_hidden', false)->count(),
            'profil' => MemberPage::query()->where('reports_count', '>', 0)->where('status', 'published')->count(),
            'komentar' => MemberPageComment::query()->where('reports_count', '>', 0)->where('is_hidden', false)->count(),
        ];

        $activity = collect()
            ->merge(User::query()->latest('id')->limit(6)->get(['id', 'username', 'name', 'email', 'role', 'provider', 'created_at'])
                ->map(fn (User $u): array => ['at' => $u->created_at, 'icon' => '👤', 'text' => ($u->role === UserRole::Member ? 'User baru ' : 'Akun '.$u->role->value.' ').($u->username ? '@'.$u->username : ($u->name ?: '#'.$u->id)), 'href' => route('panel.users.show', $u->id)]))
            ->merge(Article::query()->latest('id')->limit(5)->get(['id', 'title', 'status', 'created_at'])
                ->map(fn (Article $a): array => ['at' => $a->created_at, 'icon' => '📰', 'text' => 'Artikel: '.$a->title.($a->status !== 'published' ? ' ('.$a->status.')' : ''), 'href' => route('panel.news.edit', $a->id)]))
            ->merge(MemberPost::query()->with('user:id,username')->latest('id')->limit(5)->get(['id', 'user_id', 'body', 'created_at'])
                ->map(fn (MemberPost $p): array => ['at' => $p->created_at, 'icon' => '💬', 'text' => 'Curhatan @'.($p->user?->username ?? '?').': '.Str::limit((string) $p->body, 70), 'href' => route('panel.community.posts', ['f' => 'terbaru'])]))
            ->merge(ArticleComment::query()->with('user:id,username')->latest('id')->limit(4)->get(['id', 'user_id', 'body', 'created_at'])
                ->map(fn (ArticleComment $c): array => ['at' => $c->created_at, 'icon' => '🗨️', 'text' => 'Komentar berita @'.($c->user?->username ?? '?').': '.Str::limit((string) $c->body, 70), 'href' => route('panel.news.comments')]))
            ->merge(MemberPageComment::query()->with('user:id,username')->latest('id')->limit(4)->get(['id', 'user_id', 'body', 'created_at'])
                ->map(fn (MemberPageComment $c): array => ['at' => $c->created_at, 'icon' => '🧱', 'text' => 'Komentar profil @'.($c->user?->username ?? '?').': '.Str::limit((string) $c->body, 70), 'href' => route('panel.community.comments')]))
            ->filter(fn (array $row): bool => $row['at'] !== null)
            ->sortByDesc('at')->take(14)->values();

        return view('panel.dashboard', [
            'counts' => $counts,
            'reported' => $reported,
            'activity' => $activity,
            'audit' => AdminAuditLog::query()->latest('id')->limit(6)->get(),
        ]);
    }

    /** GA4 block for Ringkasan, fetched after first paint (the Google call can take a second; cached ~1 hour). */
    public function ga(Request $request, GoogleStats $stats): View
    {
        $days = $stats->normalizeRange($request->query('days', 28));
        $missing = $stats->missingSetup();

        return view('panel._ga', [
            'days' => $days,
            'missing' => $missing['ga4'],
            'ga4' => $missing['ga4'] === [] ? $this->attempt(fn (): array => $stats->ga4($days)) : null,
        ]);
    }

    public function stats(Request $request, GoogleStats $stats): View
    {
        $days = $stats->normalizeRange($request->query('days'));
        $missing = $stats->missingSetup();

        return view('panel.stats', [
            'days' => $days,
            'ranges' => GoogleStats::RANGES,
            'missing' => $missing,
            'ga4' => $missing['ga4'] === [] ? $this->attempt(fn (): array => $stats->ga4($days)) : null,
            'gsc' => $missing['gsc'] === [] ? $this->attempt(fn (): array => $stats->gsc($days)) : null,
        ]);
    }

    public function refresh(Request $request, GoogleStats $stats): RedirectResponse
    {
        $days = $stats->normalizeRange($request->input('days'));
        $stats->forget($days);
        AdminAudit::log($request, 'stats.refresh', null, null, null, ['days' => $days]);

        return redirect()->route('panel.stats', ['days' => $days])->with('toast', 'Data diambil ulang dari Google.');
    }

    /**
     * @param  callable(): array<string, mixed>  $fetch
     * @return array{data?: array<string, mixed>, error?: string}
     */
    private function attempt(callable $fetch): array
    {
        try {
            return ['data' => $fetch()];
        } catch (GoogleStatsException $e) {
            return ['error' => $e->friendlyMessage()];
        }
    }
}
