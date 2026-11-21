<?php

use App\Http\Controllers\Panel\AuthController;
use App\Http\Controllers\Panel\BackupController;
use App\Http\Controllers\Panel\CommunityController;
use App\Http\Controllers\Panel\CustomPageController;
use App\Http\Controllers\Panel\DashboardController;
use App\Http\Controllers\Panel\GameController;
use App\Http\Controllers\Panel\LogController;
use App\Http\Controllers\Panel\MessageController;
use App\Http\Controllers\Panel\NewsController;
use App\Http\Controllers\Panel\UserController;
use Illuminate\Support\Facades\Route;

/*
 * Web admin panel at https://jadidaring.com/admin. Every route below /admin (except the login form)
 * goes through panel.admin: guests are sent to /admin/masuk, logged-in non-admins get 403.
 */
Route::get('/admin/masuk', [AuthController::class, 'show'])->name('panel.login');
Route::post('/admin/masuk', [AuthController::class, 'login'])->middleware('throttle:10,1')->name('panel.login.post');

Route::prefix('admin')->name('panel.')->middleware('panel.admin')->group(function (): void {
    Route::post('/keluar', [AuthController::class, 'logout'])->name('logout');

    Route::get('/', [DashboardController::class, 'index'])->name('home');
    Route::get('/ringkasan/ga', [DashboardController::class, 'ga'])->name('home.ga');
    Route::get('/statistik', [DashboardController::class, 'stats'])->name('stats');
    Route::post('/statistik/refresh', [DashboardController::class, 'refresh'])->middleware('throttle:stats-refresh')->name('stats.refresh');

    Route::get('/berita', [NewsController::class, 'index'])->name('news');
    Route::get('/berita/topik', [NewsController::class, 'topics'])->name('news.topics');
    Route::put('/berita/topik/{slug}', [NewsController::class, 'updateTopic'])->where('slug', '[a-z0-9-]{1,40}')->name('news.topics.update');
    Route::get('/berita/komentar', [NewsController::class, 'comments'])->name('news.comments');
    Route::post('/berita/komentar/{comment}/toggle', [NewsController::class, 'toggleComment'])->whereNumber('comment')->name('news.comments.toggle');
    Route::delete('/berita/komentar/{comment}', [NewsController::class, 'destroyComment'])->whereNumber('comment')->name('news.comments.destroy');
    Route::get('/berita/tulis', [NewsController::class, 'create'])->name('news.create');
    Route::post('/berita', [NewsController::class, 'store'])->name('news.store');
    Route::get('/berita/{article}', [NewsController::class, 'edit'])->whereNumber('article')->name('news.edit');
    Route::put('/berita/{article}', [NewsController::class, 'update'])->whereNumber('article')->name('news.update');
    Route::post('/berita/{article}/status', [NewsController::class, 'status'])->whereNumber('article')->name('news.status');
    Route::delete('/berita/{article}', [NewsController::class, 'destroy'])->whereNumber('article')->name('news.destroy');

    Route::get('/komunitas', [CommunityController::class, 'index'])->name('community');
    Route::get('/komunitas/komentar', [CommunityController::class, 'comments'])->name('community.comments');
    Route::post('/komunitas/komentar/{comment}/toggle', [CommunityController::class, 'toggleComment'])->whereNumber('comment')->name('community.comments.toggle');
    Route::delete('/komunitas/komentar/{comment}', [CommunityController::class, 'destroyComment'])->whereNumber('comment')->name('community.comments.destroy');
    Route::get('/komunitas/curhatan', [CommunityController::class, 'posts'])->name('community.posts');
    Route::post('/komunitas/curhatan/{post}/toggle', [CommunityController::class, 'togglePost'])->whereNumber('post')->name('community.posts.toggle');
    Route::delete('/komunitas/curhatan/{post}', [CommunityController::class, 'destroyPost'])->whereNumber('post')->name('community.posts.destroy');
    Route::post('/komunitas/curhatan-komentar/{comment}/toggle', [CommunityController::class, 'togglePostComment'])->whereNumber('comment')->name('community.postcomments.toggle');
    Route::delete('/komunitas/curhatan-komentar/{comment}', [CommunityController::class, 'destroyPostComment'])->whereNumber('comment')->name('community.postcomments.destroy');
    Route::get('/komunitas/{page}', [CommunityController::class, 'show'])->whereNumber('page')->name('community.show');
    Route::post('/komunitas/{page}/status', [CommunityController::class, 'status'])->whereNumber('page')->name('community.status');
    Route::post('/komunitas/{page}/reset-pengunjung', [CommunityController::class, 'resetViews'])->whereNumber('page')->name('community.reset');

    Route::get('/user', [UserController::class, 'index'])->name('users');
    Route::get('/user/{user}', [UserController::class, 'show'])->whereNumber('user')->name('users.show');
    Route::post('/user/{user}/blokir', [UserController::class, 'ban'])->whereNumber('user')->name('users.ban');
    Route::post('/user/{user}/buka-blokir', [UserController::class, 'unban'])->whereNumber('user')->name('users.unban');
    Route::delete('/user/{user}', [UserController::class, 'destroy'])->whereNumber('user')->name('users.destroy');

    Route::get('/game', [GameController::class, 'index'])->name('games');
    Route::get('/game/{game}', [GameController::class, 'show'])->whereNumber('game')->name('games.show');
    Route::post('/game/{game}/listing', [GameController::class, 'listing'])->whereNumber('game')->name('games.listing');
    Route::get('/game/{game}/ekspor', [GameController::class, 'export'])->whereNumber('game')->name('games.export');
    Route::get('/game/{game}/skor/{score}', [GameController::class, 'score'])->whereNumber(['game', 'score'])->name('games.score');
    Route::put('/game/{game}/skor/{score}', [GameController::class, 'updateScore'])->whereNumber(['game', 'score'])->name('games.score.update');
    Route::delete('/game/{game}/skor/{score}', [GameController::class, 'destroyScore'])->whereNumber(['game', 'score'])->name('games.score.destroy');
    Route::post('/game/{game}/skor-kosongkan', [GameController::class, 'clearScores'])->whereNumber('game')->name('games.scores.clear');
    Route::get('/game/{game}/room/{room}', [GameController::class, 'room'])->whereNumber(['game', 'room'])->name('games.room');
    Route::delete('/game/{game}/room/{room}', [GameController::class, 'destroyRoom'])->whereNumber(['game', 'room'])->name('games.room.destroy');
    Route::post('/game/{game}/room-kosongkan', [GameController::class, 'clearRooms'])->whereNumber('game')->name('games.rooms.clear');

    Route::get('/custom-page', [CustomPageController::class, 'index'])->name('pages');
    Route::get('/custom-page/baru', [CustomPageController::class, 'create'])->name('pages.create');
    Route::post('/custom-page', [CustomPageController::class, 'store'])->name('pages.store');
    Route::get('/custom-page/{page}', [CustomPageController::class, 'edit'])->whereNumber('page')->name('pages.edit');
    Route::put('/custom-page/{page}', [CustomPageController::class, 'update'])->whereNumber('page')->name('pages.update');
    Route::post('/custom-page/{page}/pin', [CustomPageController::class, 'pin'])->whereNumber('page')->name('pages.pin');
    Route::post('/custom-page/{page}/urutan', [CustomPageController::class, 'move'])->whereNumber('page')->name('pages.move');
    Route::post('/custom-page/{page}/alias', [CustomPageController::class, 'storeAlias'])->whereNumber('page')->name('pages.alias.store');
    Route::delete('/custom-page/{page}/alias/{alias}', [CustomPageController::class, 'destroyAlias'])->whereNumber(['page', 'alias'])->name('pages.alias.destroy');

    Route::get('/pesan', [MessageController::class, 'index'])->name('messages');
    Route::post('/pesan/{message}/baca', [MessageController::class, 'read'])->whereNumber('message')->name('messages.read');
    Route::delete('/pesan/{message}', [MessageController::class, 'destroy'])->whereNumber('message')->name('messages.destroy');

    Route::get('/log', [LogController::class, 'index'])->name('log');
    Route::get('/backup', [BackupController::class, 'index'])->name('backups');
    Route::get('/backup/{dir}/{name}', [BackupController::class, 'download'])->whereIn('dir', ['user', 'admin'])->where('name', '[A-Za-z0-9_.-]{1,200}\.json')->name('backups.download');
});
