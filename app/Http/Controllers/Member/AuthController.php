<?php

namespace App\Http\Controllers\Member;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\SocialAuth;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class AuthController extends Controller
{
    public function showLogin(Request $request): View
    {
        $next = (string) $request->query('next', '');

        if (preg_match('#^/(?!/)[A-Za-z0-9/_\-.?=&%]{0,200}$#', $next) === 1) {
            $request->session()->put('url.intended', url($next));
        }

        return view('member.login', ['providers' => SocialAuth::enabledProviders()]);
    }

    public function login(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'login' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ]);

        $login = Str::lower(trim($data['login']));
        $key = Str::transliterate($login.'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($key, 5)) {
            throw ValidationException::withMessages([
                'login' => 'Terlalu banyak percobaan. Coba lagi dalam '.RateLimiter::availableIn($key).' detik.',
            ]);
        }

        $field = str_contains($login, '@') ? 'email' : 'username';

        if (! Auth::attempt([$field => $login, 'password' => $data['password'], 'role' => UserRole::Member->value], $request->boolean('remember'))) {
            RateLimiter::hit($key);

            throw ValidationException::withMessages(['login' => 'Nama pengguna atau kata sandi salah.']);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();

        return redirect()->intended(route('member.account'));
    }

    public function showRegister(): View
    {
        return view('member.register', ['providers' => SocialAuth::enabledProviders()]);
    }

    public function register(Request $request): RedirectResponse
    {
        $request->merge(['username' => Str::lower(trim((string) $request->input('username')))]);

        $data = $request->validate([
            'username' => ['required', 'string', 'min:3', 'max:20', 'regex:/^[a-z0-9_]+$/', 'unique:users,username'],
            'password' => ['required', 'string', 'min:8', 'max:100', 'confirmed'],
            'email' => ['nullable', 'string', 'email', 'max:255', 'unique:users,email'],
            'website' => ['nullable', 'max:0'],
        ], [
            'username.regex' => 'Nama pengguna hanya boleh huruf kecil, angka, dan garis bawah.',
            'username.unique' => 'Nama pengguna sudah dipakai.',
            'email.unique' => 'Email sudah terdaftar.',
            'password.confirmed' => 'Konfirmasi kata sandi tidak cocok.',
            'password.min' => 'Kata sandi minimal 8 karakter.',
        ]);

        $user = User::query()->create([
            'name' => $data['username'],
            'username' => $data['username'],
            'email' => filled($data['email'] ?? null) ? Str::lower($data['email']) : null,
            'password' => $data['password'],
            'role' => UserRole::Member,
        ]);

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->route('member.account');
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    public function account(Request $request): View
    {
        return view('member.account', ['user' => $request->user()]);
    }

    public function updateName(Request $request): RedirectResponse
    {
        $request->merge(['name' => trim((string) preg_replace('/\s+/', ' ', (string) $request->input('name')))]);

        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:20', 'regex:/^(?=.*[\p{L}\p{N}])[\p{L}\p{N} ._\'-]+$/u'],
        ], [
            'name.regex' => 'Nama tampilan hanya boleh huruf, angka, spasi, titik, garis bawah, apostrof, dan tanda hubung.',
        ]);

        $request->user()->forceFill(['name' => $data['name']])->save();

        return back()->with('status', 'Nama tampilan diperbarui. Skor dan data mainmu ikut berubah.');
    }

    public function updateEmail(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'email' => ['nullable', 'string', 'email', 'max:255', 'unique:users,email,'.$user->id],
        ]);

        $user->email = filled($data['email'] ?? null) ? Str::lower($data['email']) : null;
        $user->save();

        return back()->with('status', 'Email disimpan.');
    }
}
