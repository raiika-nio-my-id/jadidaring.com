<?php

namespace App\Http\Controllers\Member;

use App\Http\Controllers\Controller;
use App\Services\SocialAuth;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;

class SocialController extends Controller
{
    public function redirect(string $provider): RedirectResponse
    {
        abort_unless(in_array($provider, ['google', 'github'], true) && SocialAuth::enabled($provider), 404);

        return Socialite::driver($provider)->redirectUrl(route('member.social.callback', $provider))->redirect();
    }

    public function callback(Request $request, string $provider): RedirectResponse
    {
        abort_unless(in_array($provider, ['google', 'github'], true) && SocialAuth::enabled($provider), 404);

        try {
            $social = Socialite::driver($provider)->redirectUrl(route('member.social.callback', $provider))->user();
        } catch (\Throwable $e) {
            return redirect()->route('member.login')->withErrors(['login' => 'Login dengan '.ucfirst($provider).' gagal. Coba lagi.']);
        }

        $user = SocialAuth::resolveUser($provider, (string) $social->getId(), $social->getEmail(), $social->getNickname() ?: $social->getName());

        return $this->finish($request, $user);
    }

    public function telegram(Request $request): RedirectResponse
    {
        abort_unless(SocialAuth::enabled('telegram'), 404);

        $data = $request->query();

        if (! SocialAuth::verifyTelegram(is_array($data) ? $data : [])) {
            return redirect()->route('member.login')->withErrors(['login' => 'Login Telegram gagal diverifikasi.']);
        }

        $user = SocialAuth::resolveUser('telegram', (string) $data['id'], null, (string) ($data['username'] ?? $data['first_name'] ?? ''));

        return $this->finish($request, $user);
    }

    private function finish(Request $request, \App\Models\User $user): RedirectResponse
    {
        Auth::login($user, true);
        $request->session()->regenerate();

        return redirect()->intended(route('member.account'));
    }
}
