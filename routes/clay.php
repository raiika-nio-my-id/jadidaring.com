<?php

use App\Http\Controllers\ClayController;
use App\Http\Controllers\TenantController;
use Illuminate\Support\Facades\Route;

// Canonical public host (bare domain). Static paths are registered before
// the legacy /{tenant} client-site group, so they always win.
Route::get('/', [ClayController::class, 'home'])->name('clay.home');
Route::get('/berita', [ClayController::class, 'berita'])->name('clay.berita');
Route::get('/berita/{topik}', [ClayController::class, 'beritaTopik'])->name('clay.berita.topik');
Route::get('/game', [ClayController::class, 'game'])->name('clay.game');
Route::get('/komunitas', [ClayController::class, 'komunitas'])->name('clay.komunitas');
Route::get('/syarat-ketentuan', [ClayController::class, 'terms'])->name('clay.terms');
Route::get('/robots.txt', [ClayController::class, 'robots'])->name('clay.robots');
Route::get('/sitemap.xml', [ClayController::class, 'sitemap'])->name('clay.sitemap');

Route::get('/game/{slug}', [TenantController::class, 'showGame'])->name('clay.game.show');
Route::get('/game/{slug}/', [TenantController::class, 'showGame']);
Route::get('/game/{slug}/syarat-ketentuan', [TenantController::class, 'gameTerms'])->name('clay.game.terms');
