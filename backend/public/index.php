<?php

declare(strict_types=1);

use App\Core\App;

require __DIR__ . '/../src/autoload.php';

App::boot(dirname(__DIR__));
App::run(require dirname(__DIR__) . '/src/routes.php');
