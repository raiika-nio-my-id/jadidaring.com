<?php

use App\Http\Controllers\Api\Admin\BedtimeStoryController as ApiBedtimeStoryController;
use App\Http\Controllers\Api\Admin\ClientController;
use App\Http\Controllers\Api\Admin\CommunityController;
use App\Http\Controllers\Api\Admin\GameExportController;
use App\Http\Controllers\Api\Admin\NewsController;
use Illuminate\Support\Facades\Route;

Route::post('/clients', [ClientController::class, 'store'])->name('clients.store');

Route::patch('/clients/{companyProfile}', [ClientController::class, 'update'])
    ->whereNumber('companyProfile')
    ->name('clients.update');

Route::patch('/clients/subdomain/{subdomain}', [ClientController::class, 'updateBySubdomain'])
    ->where('subdomain', '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?')
    ->name('clients.update-by-subdomain');

Route::get('/news/topics', [NewsController::class, 'topics'])->name('news.topics');
Route::patch('/news/topics/{slug}', [NewsController::class, 'updateTopic'])->name('news.topics.update');
Route::post('/news/articles', [NewsController::class, 'store'])->name('news.articles.store');
Route::patch('/news/articles/{article}', [NewsController::class, 'update'])->whereNumber('article')->name('news.articles.update');
Route::patch('/news/comments/{comment}', [NewsController::class, 'moderateComment'])->whereNumber('comment')->name('news.comments.moderate');
Route::get('/community/pages', [CommunityController::class, 'pages'])->name('community.pages');
Route::patch('/community/pages/{page}', [CommunityController::class, 'updatePage'])->whereNumber('page')->name('community.pages.update');
Route::get('/community/comments', [CommunityController::class, 'comments'])->name('community.comments');
Route::patch('/community/comments/{comment}', [CommunityController::class, 'moderateComment'])->whereNumber('comment')->name('community.comments.moderate');
Route::get('/news/articles', [NewsController::class, 'index'])->name('news.articles.index');
Route::delete('/news/articles/{article}', [NewsController::class, 'destroy'])->whereNumber('article')->name('news.articles.destroy');
Route::post('/news/articles/{article}/image', [NewsController::class, 'setImage'])->whereNumber('article')->middleware('throttle:30,1')->name('news.articles.image.set');
Route::delete('/news/articles/{article}/image', [NewsController::class, 'clearImage'])->whereNumber('article')->name('news.articles.image.clear');

Route::get('/bedtime-stories', [ApiBedtimeStoryController::class, 'index'])->name('bedtime.stories.index');
Route::post('/bedtime-stories', [ApiBedtimeStoryController::class, 'store'])->middleware('throttle:20,1')->name('bedtime.stories.store');
Route::patch('/bedtime-stories/{bedtimeStory}', [ApiBedtimeStoryController::class, 'update'])->whereNumber('bedtimeStory')->name('bedtime.stories.update');
Route::delete('/bedtime-stories/{bedtimeStory}', [ApiBedtimeStoryController::class, 'destroy'])->whereNumber('bedtimeStory')->name('bedtime.stories.destroy');

// Read-only export of a game's database html (games only, GM key scrubbed) for moving it into resources/games.
Route::get('/games/{subdomain}/html', [GameExportController::class, 'show'])
    ->where('subdomain', '[A-Za-z0-9-]{1,63}')
    ->name('games.html');
