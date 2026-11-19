@extends('layouts.clay')

@section('content')
    <div class="clay-section ch-page">
        <a href="/u/{{ $post->user->username }}#curhatan" class="news-back"><span aria-hidden="true">&larr;</span> Profil {{ '@'.$post->user->username }}</a>
        @if (session('status'))<p class="news-comments__msg" role="status">{{ session('status') }}</p>@endif
        @error('body')<p class="news-comments__msg" role="alert">{{ $message }}</p>@enderror
        @include('clay._curhat-card', ['post' => $post, 'allComments' => true])
    </div>
    <script src="{{ \App\Support\AssetUrl::to('js/curhatan.js') }}" defer></script>
@endsection
