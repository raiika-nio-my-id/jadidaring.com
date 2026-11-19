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
        \App\Support\Ga4::flash('login', ['method' => 'password']);

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
            'email' => ['nullable', 'string', 'email', 'max:255', 'unique:users,email', function ($attr, $value, $fail) {
                if (filled($value) && \App\Support\EmailNormalizer::taken((string) $value)) {
                    $fail('Email sudah terdaftar.');
                }
            }],
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
        \App\Support\Ga4::flash('sign_up', ['method' => 'password']);

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
        $isPasswordAccount = $user->provider === null;

        $rules = ['email' => ['required', 'string', 'email', 'max:255']];
        if ($isPasswordAccount) {
            $rules['current_password'] = ['required', 'string'];
        }
        $data = $request->validate($rules, [
            'email.required' => 'Isi alamat email baru.',
            'current_password.required' => 'Masukkan kata sandimu saat ini.',
        ]);

        if ($isPasswordAccount && ! \Illuminate\Support\Facades\Hash::check($data['current_password'], (string) $user->password)) {
            return back()->withErrors(['current_password' => 'Kata sandi salah.']);
        }

        $new = Str::lower(trim($data['email']));

        if (\App\Support\EmailNormalizer::normalize($new) === \App\Support\EmailNormalizer::normalize($user->email)) {
            return back()->withErrors(['email' => 'Itu sudah jadi emailmu.']);
        }

        if (\App\Support\EmailNormalizer::taken($new, $user->id)) {
            return back()->withErrors(['email' => 'Email sudah terdaftar.']);
        }

        $user->forceFill(['pending_email' => $new])->save();

        \App\Support\EmailChange::sendVerification($user, $new);

        return back()->with('status', 'Kami mengirim tautan verifikasi ke '.$new.'. Emailmu baru berubah setelah tautan itu diklik (berlaku 60 menit).');
    }

    private function emailResult(array $data): \Illuminate\Http\Response
    {
        return response()->view('member.email-result', $data)->header('X-No-Public-Cache', '1')->header('Cache-Control', 'no-store, private');
    }

    public function verifyEmail(Request $request, User $user, string $hash): \Illuminate\Http\Response
    {
        abort_unless($request->hasValidSignature() && $user->pending_email !== null && hash_equals(sha1($user->pending_email), $hash), 403);

        $new = $user->pending_email;

        if (\App\Support\EmailNormalizer::taken($new, $user->id)) {
            $user->forceFill(['pending_email' => null])->save();

            return $this->emailResult(['ok' => false, 'message' => 'Email itu sudah dipakai akun lain, jadi perubahan dibatalkan.']);
        }

        $user->forceFill(['email' => $new, 'pending_email' => null, 'email_verified_at' => now()])->save();

        return $this->emailResult(['ok' => true, 'message' => 'Email '.$new.' sudah terverifikasi dan jadi emailmu.']);
    }

    public function reportEmailChange(Request $request, User $user): \Illuminate\Http\Response
    {
        abort_unless($request->hasValidSignature(), 403);

        $cancelled = $user->pending_email !== null;
        if ($cancelled) {
            $user->forceFill(['pending_email' => null])->save();
        }

        return $this->emailResult(['ok' => true, 'message' => $cancelled
            ? 'Permintaan ganti email dibatalkan. Kalau bukan kamu, segera ganti kata sandimu.'
            : 'Terima kasih. Perubahan ini sudah diterapkan sebelumnya. Hubungi kami lewat halaman Kontak supaya kami bantu mengamankan akunmu.']);
    }

    /** Members can delete their own account: confirms username + password, cascades only their own rows. */
    public function deleteAccount(Request $request): RedirectResponse
    {
        $user = $request->user();

        abort_unless($user->isMember(), 403);

        $request->validate(['confirm' => ['required', 'string'], 'password' => ['nullable', 'string']]);

        if (Str::lower(trim((string) $request->input('confirm'))) !== Str::lower($user->username)) {
            return back()->withErrors(['confirm' => 'Ketik nama penggunamu persis untuk konfirmasi.']);
        }

        if ($user->password !== null && ! \Illuminate\Support\Facades\Hash::check((string) $request->input('password'), $user->password)) {
            return back()->withErrors(['password' => 'Kata sandi salah.']);
        }

        if (\App\Models\CompanyProfile::query()->where('user_id', $user->id)->exists()) {
            return back()->withErrors(['confirm' => 'Akun ini memiliki situs klien dan tidak bisa dihapus sendiri.']);
        }

        Auth::guard('web')->logout();
        $user->delete();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/')->with('status', 'Akunmu sudah dihapus.');
    }
}
