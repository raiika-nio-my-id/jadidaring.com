<?php

namespace App\Http\Controllers\Member;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\SocialAuth;
use App\Services\TelegramOidc;
use App\Support\Ga4;
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

        return $this->finish($request, $user, $provider);
    }

    /** OpenID Connect: full-page redirect to oauth.telegram.org (opens the Telegram app on phones). */
    public function telegramRedirect(): RedirectResponse
    {
        abort_unless(TelegramOidc::enabled(), 404);

        return redirect()->away(TelegramOidc::authorizeUrl());
    }

    public function telegramOidcCallback(Request $request): RedirectResponse
    {
        abort_unless(TelegramOidc::enabled(), 404);

        if ($request->filled('error')) {
            $request->session()->forget('tg_oidc');

            return redirect()->route('member.login')->withErrors(['login' => 'Login Telegram dibatalkan.']);
        }

        try {
            $claims = TelegramOidc::complete($request->query('state'), $request->query('code'));
        } catch (\RuntimeException $e) {
            return redirect()->route('member.login')->withErrors(['login' => $e->getMessage()]);
        } catch (\Throwable $e) {
            report($e);

            return redirect()->route('member.login')->withErrors(['login' => 'Login Telegram gagal. Coba lagi.']);
        }

        // Same provider_id as the classic widget (numeric Telegram user id), so existing accounts keep working.
        $nick = (string) ($claims['preferred_username'] ?? $claims['given_name'] ?? $claims['name'] ?? '');
        $user = SocialAuth::resolveUser('telegram', (string) $claims['id'], null, $nick);

        return $this->finish($request, $user, 'telegram');
    }

    public function telegram(Request $request): RedirectResponse
    {
        abort_unless(SocialAuth::telegramWidgetEnabled(), 404);

        $data = $request->query();

        if (! SocialAuth::verifyTelegram(is_array($data) ? $data : [])) {
            return redirect()->route('member.login')->withErrors(['login' => 'Login Telegram gagal diverifikasi.']);
        }

        $user = SocialAuth::resolveUser('telegram', (string) $data['id'], null, (string) ($data['username'] ?? $data['first_name'] ?? ''));

        return $this->finish($request, $user, 'telegram');
    }

    private function finish(Request $request, User $user, string $method): RedirectResponse
    {
        if ($user->isBanned()) {
            return redirect()->route('member.login')->withErrors(['login' => $user->banMessage()]);
        }

        Auth::login($user, true);
        $request->session()->regenerate();
        Ga4::flash($user->wasRecentlyCreated ? 'sign_up' : 'login', ['method' => $method]);

        return redirect()->intended(route('member.account'))->with('status', session('social_notice'));
    }
}
