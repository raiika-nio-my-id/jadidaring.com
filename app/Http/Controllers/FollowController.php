<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class FollowController extends Controller
{
    private function target(string $username): User
    {
        $user = User::query()->where('username', $username)->first();
        abort_unless($user instanceof User && $user->isMember(), 404);

        return $user;
    }

    public function follow(Request $request, string $username): RedirectResponse
    {
        $me = $request->user();
        $target = $this->target($username);
        abort_unless($me->isMember(), 403);

        if ($me->id === $target->id) {
            return back()->with('status', 'Kamu tidak bisa mengikuti dirimu sendiri.');
        }

        // The unique (follower_id, followed_id) index makes a double click harmless.
        DB::table('member_follows')->insertOrIgnore([
            'follower_id' => $me->id, 'followed_id' => $target->id, 'created_at' => now(), 'updated_at' => now(),
        ]);

        \App\Support\Ga4::flash('follow', ['content_type' => 'profile']);

        return back()->with('status', 'Kamu sekarang mengikuti @'.$target->username.'.');
    }

    public function unfollow(Request $request, string $username): RedirectResponse
    {
        $target = $this->target($username);
        DB::table('member_follows')->where('follower_id', $request->user()->id)->where('followed_id', $target->id)->delete();

        \App\Support\Ga4::flash('unfollow', ['content_type' => 'profile']);

        return back()->with('status', 'Kamu berhenti mengikuti @'.$target->username.'.');
    }

    public function followers(string $username): View
    {
        $owner = $this->target($username);

        return $this->list($owner, 'Pengikut', $owner->followers()->orderByPivot('created_at', 'desc')->orderByDesc('users.id'));
    }

    public function following(string $username): View
    {
        $owner = $this->target($username);

        return $this->list($owner, 'Mengikuti', $owner->following()->orderByPivot('created_at', 'desc')->orderByDesc('users.id'));
    }

    private function list(User $owner, string $title, $query): View
    {
        $users = $query->with('memberPage')->simplePaginate(30);

        return view('clay.komunitas-follow', [
            'metaTitle' => $title.' @'.$owner->username.' — Jadidaring',
            'metaDescription' => $title.' @'.$owner->username.' di komunitas Jadidaring.',
            'noindex' => true,
            'owner' => $owner, 'title' => $title, 'users' => $users,
        ]);
    }
}
