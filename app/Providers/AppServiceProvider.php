<?php

namespace App\Providers;

use App\Models\CompanyProfile;
use App\Models\User;
use App\Policies\CompanyProfilePolicy;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Host-only admin cookies. Never Domain=.jadidaring.com / .jadidaring.test.
        Config::set('session.domain', null);
        Config::set('session.http_only', true);
        // Strict on the admin host. Lax elsewhere so an OAuth provider's
        // top-level redirect back to /auth/{provider}/callback keeps the session.
        $isAdminHost = strtolower(request()->getHost()) === strtolower((string) config('singlepage.admin_domain'));
        Config::set('session.same_site', $isAdminHost ? 'strict' : 'lax');

        ResetPassword::createUrlUsing(function (object $user, string $token): string {
            return route('member.password.reset', [
                'token' => $token,
                'email' => $user->getEmailForPasswordReset(),
            ]);
        });

        ResetPassword::toMailUsing(function (object $user, string $token) {
            $url = route('member.password.reset', ['token' => $token, 'email' => $user->getEmailForPasswordReset()]);
            Config::set('app.name', 'Jadidaring'); // mail layout header/footer
            $minutes = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60);

            return (new MailMessage)
                ->subject('Atur ulang kata sandi Jadidaring')
                ->greeting('Halo!')
                ->line('Kami menerima permintaan untuk mengatur ulang kata sandi akun Jadidaring kamu.')
                ->action('Atur ulang kata sandi', $url)
                ->line('Tautan ini berlaku '.$minutes.' menit.')
                ->line('Kalau bukan kamu yang meminta, abaikan saja email ini. Kata sandimu tidak berubah.')
                ->salutation('Salam, Tim Jadidaring');
        });

        Gate::policy(CompanyProfile::class, CompanyProfilePolicy::class);

        Gate::define('manage-settings', function (User $user): bool {
            return $user->can('manageSettings', CompanyProfile::class);
        });

        // Named, per-member limiters (separate counters; unnamed throttles share one key per user).
        RateLimiter::for('email-change', fn (Request $request) => [Limit::perHour(5)->by('email-change:'.($request->user()?->id ?? $request->ip())), Limit::perMinute(2)->by('email-change-m:'.($request->user()?->id ?? $request->ip()))]);
        RateLimiter::for('profile-save', fn (Request $request) => Limit::perMinute(30)->by('profile-save:'.($request->user()?->id ?? $request->ip())));
        RateLimiter::for('profile-autosave', fn (Request $request) => Limit::perMinute(40)->by('profile-autosave:'.($request->user()?->id ?? $request->ip())));
        RateLimiter::for('profile-upload', fn (Request $request) => [
            Limit::perMinute(8)->by('profile-upload-m:'.($request->user()?->id ?? $request->ip())),
            Limit::perHour(60)->by('profile-upload-h:'.($request->user()?->id ?? $request->ip())),
        ]);
        // Curhatan: per member, per minute and per hour.
        $curhat = static fn (string $name, int $perMinute, int $perHour) => RateLimiter::for($name, fn (Request $request) => [
            Limit::perMinute($perMinute)->by($name.'-m:'.($request->user()?->id ?? $request->ip())),
            Limit::perHour($perHour)->by($name.'-h:'.($request->user()?->id ?? $request->ip())),
        ]);
        $curhat('curhat-post', 5, 30);
        $curhat('curhat-comment', 8, 120);
        $curhat('curhat-like', 60, 600);
        $curhat('curhat-report', 10, 40);
        RateLimiter::for('profile-preview', fn (Request $request) => Limit::perMinute(240)->by('profile-preview:'.($request->user()?->id ?? $request->ip())));

        RateLimiter::for('admin-api', function (Request $request) {
            return Limit::perMinute(60)->by($request->ip());
        });

        RateLimiter::for('game-input', function (Request $request) {
            $token = (string) ($request->bearerToken() ?: $request->header('X-Player-Token', ''));
            $identity = $token !== '' ? hash('sha256', $token) : (string) $request->ip();

            return Limit::perMinute(120)->by($identity);
        });
    }
}
