@php
    $home = \App\Support\ErrorPage::home();
    $code = isset($exception) && method_exists($exception, 'getStatusCode') ? (int) $exception->getStatusCode() : 500;
    $accent = 'pink'; $mood = 'oops';
    $title = 'Server lagi nggak enak badan';
    $pageTitle = 'Kesalahan server';
    $lead = 'Ada gangguan di sisi kami. Kesalahannya sudah tercatat. Tunggu sebentar lalu coba lagi ya.';
@endphp
@extends('errors._layout')

@section('actions')
  <button class="ed-btn ed-btn--primary" type="button" data-ed-reload>@include('errors._icons.reload') Coba lagi</button>
  <a class="ed-btn" href="{{ $home }}/">@include('errors._icons.home') Kembali ke Beranda</a>
@endsection
