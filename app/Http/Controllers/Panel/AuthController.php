<?php

namespace App\Http\Controllers\Panel;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Services\Admin\AdminAudit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

/** Admin login for the /admin panel on the public host: same admin account (email + password) as admin.jadidaring.com. */
class AuthController extends Controller
{
    public function show(Request $request): View|RedirectResponse
    {
        if ($request->user()?->can('access-admin-panel')) {
            return redirect()->route('panel.home');
        }

        return view('panel.login', ['metaTitle' => 'Masuk Admin · Jadidaring', 'noindex' => true]);
    }

    public function login(Request $request): RedirectResponse|Response
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ]);

        $key = 'panel-login:'.Str::transliterate(Str::lower($data['email']).'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($key, 5)) {
            throw ValidationException::withMessages(['email' => 'Terlalu banyak percobaan. Coba lagi dalam '.RateLimiter::availableIn($key).' detik.']);
        }

        if (! Auth::attempt(['email' => trim($data['email']), 'password' => $data['password'], 'role' => UserRole::Admin->value], $request->boolean('remember'))) {
            RateLimiter::hit($key);

            throw ValidationException::withMessages(['email' => 'Email atau kata sandi admin salah.']);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();
        AdminAudit::log($request, 'login', 'user', $request->user()->id, $request->user()->email);

        return redirect()->intended(route('panel.home'));
    }

    public function logout(Request $request): RedirectResponse
    {
        AdminAudit::log($request, 'logout', 'user', $request->user()->id, $request->user()->email);
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('panel.login')->with('status', 'Kamu sudah keluar dari panel admin.');
    }
}
