<?php

namespace App\Http\Controllers\Panel;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\User;
use App\Services\Admin\AdminAudit;
use App\Services\Admin\UserDeletion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\View\View;

/** /admin User: search, detail, block/unblock, delete (typed confirmation, backup first, admins refused). No admin toggle. */
class UserController extends Controller
{
    public function index(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));
        $provider = (string) $request->query('provider', '');
        $f = in_array($request->query('f'), ['member', 'admin', 'client', 'diblokir'], true) ? (string) $request->query('f') : '';

        $users = User::query()
            ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x->where('username', 'like', '%'.$q.'%')->orWhere('email', 'like', '%'.$q.'%')->orWhere('name', 'like', '%'.$q.'%')->orWhere('provider_id', $q)))
            ->when(in_array($provider, ['google', 'github', 'telegram'], true), fn ($w) => $w->where('provider', $provider))
            ->when($provider === 'password', fn ($w) => $w->whereNull('provider'))
            ->when(in_array($f, ['member', 'admin', 'client'], true), fn ($w) => $w->where('role', $f))
            ->when($f === 'diblokir', fn ($w) => $w->whereNotNull('banned_at'))
            ->orderByDesc('id')
            ->paginate(25, ['id', 'name', 'username', 'email', 'role', 'provider', 'created_at', 'last_login_at', 'banned_at'])->withQueryString();

        return view('panel.users.index', ['users' => $users, 'q' => $q, 'provider' => $provider, 'f' => $f]);
    }

    public function show(Request $request, int $user): View
    {
        $model = User::query()->findOrFail($user);
        $count = fn (string $table, string $col = 'user_id'): int => Schema::hasTable($table) ? DB::table($table)->where($col, $model->id)->count() : 0;

        return view('panel.users.show', [
            'user' => $model,
            'page' => $model->memberPage()->first(['id', 'status', 'views', 'reports_count']),
            'counts' => [
                'Curhatan' => $count('member_posts'),
                'Komentar curhatan' => $count('member_post_comments'),
                'Komentar profil' => $count('member_page_comments'),
                'Komentar berita' => $count('article_comments'),
                'Pengikut' => $count('member_follows', 'followed_id'),
                'Mengikuti' => $count('member_follows', 'follower_id'),
                'Skor game' => $count('game_scores'),
                'Main di room' => $count('game_players'),
            ],
            'sessions' => Schema::hasTable('sessions') ? DB::table('sessions')->where('user_id', $model->id)->count() : 0,
            'deleteRefusal' => UserDeletion::refusal($model),
            'isSelf' => $request->user()->id === $model->id,
            'audit' => AdminAuditLog::query()->where('target_type', 'user')->where('target_id', (string) $model->id)->latest('id')->limit(10)->get(),
        ]);
    }

    public function ban(Request $request, int $user): RedirectResponse
    {
        $model = User::query()->findOrFail($user);

        if ($model->role === UserRole::Admin || $model->id === $request->user()->id) {
            return back()->with('toast_error', 'Akun admin tidak bisa diblokir.');
        }

        $data = $request->validate(['reason' => ['nullable', 'string', 'max:200']]);
        $model->forceFill(['banned_at' => now()])->save();
        DB::table('sessions')->where('user_id', $model->id)->delete();
        AdminAudit::log($request, 'user.ban', 'user', $model->id, $model->username ?? $model->email, ['reason' => $data['reason'] ?? null]);

        return back()->with('toast', 'User diblokir dan dikeluarkan dari semua sesi.');
    }

    public function unban(Request $request, int $user): RedirectResponse
    {
        $model = User::query()->findOrFail($user);
        $model->forceFill(['banned_at' => null])->save();
        AdminAudit::log($request, 'user.unban', 'user', $model->id, $model->username ?? $model->email);

        return back()->with('toast', 'Blokir dibuka. User bisa masuk lagi.');
    }

    public function destroy(Request $request, int $user): RedirectResponse
    {
        $model = User::query()->findOrFail($user);

        if (($why = UserDeletion::refusal($model)) !== null || $model->id === $request->user()->id) {
            return back()->with('toast_error', $why ?? 'Tidak bisa menghapus akunmu sendiri.');
        }

        $request->validate(['confirm' => ['required', 'string', 'in:'.$model->username]], ['confirm.in' => 'Username yang diketik tidak cocok.', 'confirm.required' => 'Ketik username untuk konfirmasi.']);

        try {
            $file = UserDeletion::delete($model);
        } catch (\RuntimeException $e) {
            return back()->with('toast_error', $e->getMessage());
        }

        AdminAudit::log($request, 'user.delete', 'user', $user, $model->username, ['backup' => basename($file), 'provider' => $model->provider]);

        return redirect()->route('panel.users')->with('toast', '@'.$model->username.' dihapus. Backup: '.basename($file));
    }
}
