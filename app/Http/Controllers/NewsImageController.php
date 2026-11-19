<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Services\NewsImage;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class NewsImageController extends Controller
{
    public function show(Request $request, int $id, int $width): BinaryFileResponse
    {
        $article = Article::query()->visible()->findOrFail($id);
        $file = NewsImage::file($article, $width);
        abort_if($file === null || ! is_file($file), 404);

        $response = new BinaryFileResponse($file, 200, ['Content-Type' => 'image/webp', 'X-Content-Type-Options' => 'nosniff']);
        $response->setAutoEtag()->setAutoLastModified();
        $response->headers->set('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400');
        $response->isNotModified($request);

        return $response;
    }

    public function home(Request $request): BinaryFileResponse
    {
        $response = new BinaryFileResponse(NewsImage::homeCard(), 200, ['Content-Type' => 'image/webp', 'X-Content-Type-Options' => 'nosniff']);
        $response->setAutoEtag()->setAutoLastModified();
        $response->headers->set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400');
        $response->isNotModified($request);

        return $response;
    }
}
