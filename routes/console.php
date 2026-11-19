<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Popular rankings from Google Analytics (cron runs `schedule:run` every minute in the scheduler container).
Schedule::command('stats:refresh-popular')->everyThreeHours()->withoutOverlapping()->runInBackground();
