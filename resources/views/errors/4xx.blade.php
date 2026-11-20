@php
    $home = \App\Support\ErrorPage::home();
    $code = isset($exception) && method_exists($exception, 'getStatusCode') ? (int) $exception->getStatusCode() : 400;
    $accent = 'peach'; $mood = 'meh';
    $title = 'Ada yang kurang pas dengan permintaanmu';
    $pageTitle = 'Permintaan tidak bisa diproses';
    $lead = 'Kami nggak bisa memproses permintaan ini. Coba periksa lagi alamatnya, atau kembali ke halaman sebelumnya.';
@endphp
@extends('errors._layout')

@section('actions')
  <a class="ed-btn ed-btn--primary" href="{{ $home }}/">@include('errors._icons.home') Kembali ke Beranda</a>
  <button class="ed-btn" type="button" data-ed-back>@include('errors._icons.back') Kembali</button>
@endsection
