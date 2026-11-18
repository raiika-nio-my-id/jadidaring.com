<?php

use App\Http\Controllers\ClayController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\NewsController;
use App\Http\Controllers\Member\AuthController;
use App\Http\Controllers\Member\PasswordResetController;
use App\Http\Controllers\Member\SocialController;
use App\Http\Controllers\TenantController;
use Illuminate\Support\Facades\Route;

// Canonical public host (bare domain). Static paths are registered before
// the legacy /{tenant} client-site group, so they always win.
Route::get('/', [ClayController::class, 'home'])->name('clay.home');
Route::get('/berita', [NewsController::class, 'index'])->name('clay.berita');
Route::get('/berita/{topik}', [NewsController::class, 'topic'])->name('clay.berita.topik');
Route::get('/berita/{topik}/{slug}', [NewsController::class, 'show'])->name('clay.berita.artikel');
Route::get('/berita/{topik}/{slug}/komentar', [NewsController::class, 'comments'])->name('clay.berita.komentar');
Route::post('/berita/{topik}/{slug}/komentar', [NewsController::class, 'postComment'])->middleware('auth')->name('clay.berita.komentar.post');
Route::get('/game', [ClayController::class, 'game'])->name('clay.game');
Route::get('/komunitas', [CommunityController::class, 'index'])->name('clay.komunitas');
Route::get('/u/{username}', [CommunityController::class, 'show'])->where('username', '[a-z0-9_]{3,20}')->name('community.show');
Route::get('/syarat-ketentuan', [ClayController::class, 'terms'])->name('clay.terms');
Route::get('/robots.txt', [ClayController::class, 'robots'])->name('clay.robots');
Route::get('/sitemap.xml', [ClayController::class, 'sitemap'])->name('clay.sitemap');

Route::get('/game/{slug}', [TenantController::class, 'showGame'])->name('clay.game.show');
Route::get('/game/{slug}/', [TenantController::class, 'showGame']);
Route::get('/game/{slug}/syarat-ketentuan', [TenantController::class, 'gameTerms'])->name('clay.game.terms');

// Member auth (username + password, optional email, social login).
Route::middleware('guest')->group(function (): void {
    Route::get('/masuk', [AuthController::class, 'showLogin'])->name('member.login');
    Route::post('/masuk', [AuthController::class, 'login'])->middleware('throttle:20,1');
    Route::get('/daftar', [AuthController::class, 'showRegister'])->name('member.register');
    Route::post('/daftar', [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::get('/lupa-password', [PasswordResetController::class, 'showForgot'])->name('member.password.request');
    Route::post('/lupa-password', [PasswordResetController::class, 'sendLink'])->middleware('throttle:5,1')->name('member.password.email');
    Route::get('/reset-password/{token}', [PasswordResetController::class, 'showReset'])->name('member.password.reset');
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:10,1')->name('member.password.update');
    Route::get('/auth/telegram/callback', [SocialController::class, 'telegram'])->name('member.telegram.callback');
    Route::get('/auth/{provider}/redirect', [SocialController::class, 'redirect'])->whereIn('provider', ['google', 'github'])->name('member.social.redirect');
    Route::get('/auth/{provider}/callback', [SocialController::class, 'callback'])->whereIn('provider', ['google', 'github'])->name('member.social.callback');
});

Route::middleware('auth')->group(function (): void {
    Route::post('/keluar', [AuthController::class, 'logout'])->name('member.logout');
    Route::get('/akun', [AuthController::class, 'account'])->name('member.account');
    Route::get('/komunitas/halamanku', [CommunityController::class, 'edit'])->name('community.edit');
    Route::post('/komunitas/halamanku', [CommunityController::class, 'save'])->middleware('throttle:10,60')->name('community.save');
    Route::post('/u/{username}/komentar', [CommunityController::class, 'comment'])->where('username', '[a-z0-9_]{3,20}')->middleware('throttle:10,1')->name('community.comment');
    Route::post('/u/{username}/komentar/{comment}/sembunyikan', [CommunityController::class, 'hideComment'])->where('username', '[a-z0-9_]{3,20}')->whereNumber('comment')->name('community.comment.hide');
    Route::post('/u/{username}/komentar/{comment}/lapor', [CommunityController::class, 'reportComment'])->where('username', '[a-z0-9_]{3,20}')->whereNumber('comment')->middleware('throttle:20,1');
    Route::post('/u/{username}/lapor', [CommunityController::class, 'report'])->where('username', '[a-z0-9_]{3,20}')->middleware('throttle:10,1');
    Route::post('/akun/email', [AuthController::class, 'updateEmail'])->name('member.account.email');
});
