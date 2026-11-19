<?php

use App\Http\Controllers\ClayController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\FeedController;
use App\Http\Controllers\FollowController;
use App\Http\Controllers\Member\AuthController;
use App\Http\Controllers\Member\PasswordResetController;
use App\Http\Controllers\Member\SocialController;
use App\Http\Controllers\NewsController;
use App\Http\Controllers\NewsImageController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\TenantController;
use App\Http\Middleware\OptionalSession;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;

// Public, anonymous-cacheable pages: no session or cookies unless the visitor already has a session cookie.
$guestCache = [StartSession::class, ShareErrorsFromSession::class, PreventRequestForgery::class];
$cached = static fn (Illuminate\Routing\Route $r) => $r->withoutMiddleware($guestCache)->middleware([OptionalSession::class, 'public.cache']);

// Canonical public host (bare domain). Static paths are registered before
// the legacy /{tenant} client-site group, so they always win.
$cached(Route::get('/', [ClayController::class, 'home'])->name('clay.home'));
$cached(Route::get('/berita/rss.xml', [FeedController::class, 'rss'])->name('clay.rss'));
$cached(Route::get('/berita', [NewsController::class, 'index'])->name('clay.berita'));
$cached(Route::get('/berita/{topik}', [NewsController::class, 'topic'])->name('clay.berita.topik'));
$cached(Route::get('/berita/{topik}/{slug}', [NewsController::class, 'show'])->name('clay.berita.artikel'));
Route::get('/berita/{topik}/{slug}/komentar', [NewsController::class, 'comments'])->name('clay.berita.komentar');
Route::post('/berita/{topik}/{slug}/komentar', [NewsController::class, 'postComment'])->middleware('auth')->name('clay.berita.komentar.post');
$cached(Route::get('/game', [ClayController::class, 'game'])->name('clay.game'));
$cached(Route::get('/komunitas', [CommunityController::class, 'index'])->name('clay.komunitas'));
Route::get('/komunitas/prompt-spec.txt', fn () => response(file_get_contents(resource_path('static/prompt-spec.txt')), 200, ['Content-Type' => 'text/plain; charset=utf-8', 'Cache-Control' => 'public, max-age=300']));
Route::get('/komunitas/buat', [CommunityController::class, 'prompt'])->name('community.prompt');
Route::get('/u/{username}/pengikut', [FollowController::class, 'followers'])->where('username', '[a-z0-9_]{3,20}')->middleware('throttle:90,1')->name('community.followers');
Route::get('/u/{username}/mengikuti', [FollowController::class, 'following'])->where('username', '[a-z0-9_]{3,20}')->middleware('throttle:90,1')->name('community.following');
Route::get('/u/{username}', [CommunityController::class, 'show'])->where('username', '[a-z0-9_]{3,20}')->middleware('throttle:90,1')->name('community.show');
$cached(Route::get('/syarat-ketentuan', [ClayController::class, 'terms'])->name('clay.terms'));
$cached(Route::get('/robots.txt', [ClayController::class, 'robots'])->name('clay.robots'));
$cached(Route::get('/sitemap.xml', [ClayController::class, 'sitemap'])->name('clay.sitemap'));

// Feeds, images, static pages and the contact form.
$cached(Route::get('/feed', [FeedController::class, 'rss']));
$cached(Route::get('/news-sitemap.xml', [FeedController::class, 'newsSitemap'])->name('clay.newssitemap'));
Route::get('/og-home.webp', [NewsImageController::class, 'home'])->withoutMiddleware($guestCache)->name('clay.home.og');
Route::get('/gambar-berita/{id}-{width}.webp', [NewsImageController::class, 'show'])->whereNumber(['id', 'width'])->withoutMiddleware($guestCache)->name('clay.berita.gambar');
foreach (['tentang' => 'tentang', 'kebijakan-redaksi' => 'redaksi', 'kebijakan-privasi' => 'privasi'] as $path => $page) {
    $cached(Route::get('/'.$path, [PageController::class, $page])->name('clay.page.'.$page));
}
Route::get('/kontak', [PageController::class, 'contact'])->name('clay.contact');
Route::post('/kontak', [PageController::class, 'send'])->middleware('throttle:5,10')->name('clay.contact.send');

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

// Signed links from email (no login needed: the signature and pending-address hash are the proof).
Route::get('/akun/email/verifikasi/{user}/{hash}', [AuthController::class, 'verifyEmail'])->whereNumber('user')->middleware('throttle:20,1')->name('member.email.verify');
Route::get('/akun/email/lapor/{user}', [AuthController::class, 'reportEmailChange'])->whereNumber('user')->middleware('throttle:20,1')->name('member.email.report');

Route::middleware('auth')->group(function (): void {
    Route::post('/keluar', [AuthController::class, 'logout'])->name('member.logout');
    Route::get('/akun', [AuthController::class, 'account'])->name('member.account');
    Route::get('/komunitas/halamanku', [CommunityController::class, 'edit'])->name('community.edit');
    Route::get('/komunitas/halamanku/klasik', [CommunityController::class, 'editClassic'])->name('community.edit.classic');
    Route::get('/komunitas/halamanku/import', [CommunityController::class, 'importForm'])->middleware('throttle:profile-preview')->name('community.import');
    Route::post('/komunitas/buat/simpan', [CommunityController::class, 'promptSave'])->middleware('throttle:profile-preview')->name('community.prompt.save');
    Route::post('/komunitas/buat/reset', [CommunityController::class, 'promptReset'])->middleware('throttle:profile-preview')->name('community.prompt.reset');
    Route::post('/komunitas/halamanku/import', [CommunityController::class, 'importSave'])->middleware('throttle:profile-save')->name('community.import.save');
    Route::post('/komunitas/halamanku', [CommunityController::class, 'save'])->middleware('throttle:profile-save')->name('community.save');
    Route::post('/u/{username}/ikuti', [FollowController::class, 'follow'])->where('username', '[a-z0-9_]{3,20}')->middleware('throttle:30,1')->name('community.follow');
    Route::post('/u/{username}/berhenti-mengikuti', [FollowController::class, 'unfollow'])->where('username', '[a-z0-9_]{3,20}')->middleware('throttle:30,1')->name('community.unfollow');
    Route::post('/u/{username}/komentar', [CommunityController::class, 'comment'])->where('username', '[a-z0-9_]{3,20}')->middleware('throttle:10,1')->name('community.comment');
    Route::post('/u/{username}/komentar/{comment}/sembunyikan', [CommunityController::class, 'hideComment'])->where('username', '[a-z0-9_]{3,20}')->whereNumber('comment')->name('community.comment.hide');
    Route::post('/u/{username}/komentar/{comment}/lapor', [CommunityController::class, 'reportComment'])->where('username', '[a-z0-9_]{3,20}')->whereNumber('comment')->middleware('throttle:20,1');
    Route::post('/u/{username}/lapor', [CommunityController::class, 'report'])->where('username', '[a-z0-9_]{3,20}')->middleware('throttle:10,1');
    Route::post('/komunitas/halamanku/pratinjau', [CommunityController::class, 'preview'])->middleware('throttle:profile-preview')->name('community.preview');
    Route::post('/komunitas/draft-key', [CommunityController::class, 'mintKey'])->middleware('throttle:5,60')->name('community.draftkey');
    Route::post('/komunitas/halamanku/draft/terbitkan', [CommunityController::class, 'publishDraft'])->middleware('throttle:profile-save')->name('community.draft.publish');
    Route::post('/komunitas/halamanku/draft/batal', [CommunityController::class, 'cancelDraft'])->name('community.draft.cancel');
    Route::post('/akun/nama', [AuthController::class, 'updateName'])->middleware('throttle:6,60')->name('member.account.name');
    Route::post('/akun/hapus', [AuthController::class, 'deleteAccount'])->middleware('throttle:5,60')->name('member.account.delete');
    Route::post('/akun/email', [AuthController::class, 'updateEmail'])->middleware(['throttle:email-change'])->name('member.account.email');
});
