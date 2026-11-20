@php
    $home = \App\Support\ErrorPage::home();
    $code = 403; $accent = 'peach'; $mood = 'locked';
    $title = 'Eits, pintu ini dikunci';
    $pageTitle = 'Akses ditolak';
    $lead = 'Kamu belum punya akses ke halaman ini. Kalau menurutmu ini keliru, coba masuk dengan akun yang tepat atau kembali ke halaman sebelumnya.';
@endphp
@extends('errors._layout')

@section('actions')
  <a class="ed-btn ed-btn--primary" href="{{ $home }}/">@include('errors._icons.home') Kembali ke Beranda</a>
  <a class="ed-btn" href="{{ $home }}/masuk">@include('errors._icons.login') Masuk</a>
  <button class="ed-btn" type="button" data-ed-back>@include('errors._icons.back') Kembali</button>
@endsection
