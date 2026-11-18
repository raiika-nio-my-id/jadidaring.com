<?php

namespace App\Http\Controllers\Member;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\View\View;

class PasswordResetController extends Controller
{
    public function showForgot(): View
    {
        return view('member.forgot');
    }

    public function sendLink(Request $request): RedirectResponse
    {
        $data = $request->validate(['email' => ['required', 'string', 'email', 'max:255']]);

        // Members only. The reply is identical whether or not the email exists.
        try {
            Password::sendResetLink(['email' => Str::lower($data['email']), 'role' => UserRole::Member->value]);
        } catch (\Throwable $e) {
            report($e);
        }

        return back()->with('status', 'Jika email terdaftar, tautan reset kata sandi sudah dikirim.');
    }

    public function showReset(Request $request, string $token): View
    {
        return view('member.reset', ['token' => $token, 'email' => (string) $request->query('email')]);
    }

    public function reset(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string', 'min:8', 'max:100', 'confirmed'],
        ]);

        $status = Password::reset(
            ['email' => Str::lower($data['email']), 'password' => $data['password'], 'password_confirmation' => $request->input('password_confirmation'), 'token' => $data['token'], 'role' => UserRole::Member->value],
            function (User $user, string $password): void {
                $user->forceFill(['password' => Hash::make($password)])->setRememberToken(Str::random(60));
                $user->save();
                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PasswordReset) {
            return back()->withInput($request->only('email'))->withErrors(['email' => 'Tautan reset tidak valid atau sudah kedaluwarsa.']);
        }

        return redirect()->route('member.login')->with('status', 'Kata sandi diperbarui. Silakan masuk.');
    }
}
