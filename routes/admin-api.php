<?php

use App\Http\Controllers\Api\Admin\ClientController;
use Illuminate\Support\Facades\Route;

Route::post('/clients', [ClientController::class, 'store'])->name('clients.store');

Route::patch('/clients/{companyProfile}', [ClientController::class, 'update'])
    ->whereNumber('companyProfile')
    ->name('clients.update');

Route::patch('/clients/subdomain/{subdomain}', [ClientController::class, 'updateBySubdomain'])
    ->where('subdomain', '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?')
    ->name('clients.update-by-subdomain');

use App\Http\Controllers\Api\Admin\NewsController;

Route::get('/news/topics', [NewsController::class, 'topics'])->name('news.topics');
Route::patch('/news/topics/{slug}', [NewsController::class, 'updateTopic'])->name('news.topics.update');
Route::post('/news/articles', [NewsController::class, 'store'])->name('news.articles.store');
Route::patch('/news/articles/{article}', [NewsController::class, 'update'])->whereNumber('article')->name('news.articles.update');
Route::patch('/news/comments/{comment}', [NewsController::class, 'moderateComment'])->whereNumber('comment')->name('news.comments.moderate');
Route::get('/community/pages', [\App\Http\Controllers\Api\Admin\CommunityController::class, 'pages'])->name('community.pages');
Route::patch('/community/pages/{page}', [\App\Http\Controllers\Api\Admin\CommunityController::class, 'updatePage'])->whereNumber('page')->name('community.pages.update');
Route::get('/community/comments', [\App\Http\Controllers\Api\Admin\CommunityController::class, 'comments'])->name('community.comments');
Route::patch('/community/comments/{comment}', [\App\Http\Controllers\Api\Admin\CommunityController::class, 'moderateComment'])->whereNumber('comment')->name('community.comments.moderate');
Route::get('/news/articles', [NewsController::class, 'index'])->name('news.articles.index');
Route::delete('/news/articles/{article}', [NewsController::class, 'destroy'])->whereNumber('article')->name('news.articles.destroy');
