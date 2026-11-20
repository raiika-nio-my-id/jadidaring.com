@php
    $home = \App\Support\ErrorPage::home();
    $code = 500; $accent = 'pink'; $mood = 'oops';
    $title = 'Waduh, ada yang korslet';
    $pageTitle = 'Kesalahan server';
    $lead = 'Server kami lagi tersandung saat memproses halaman ini. Kesalahannya sudah tercatat dan akan kami cek. Coba lagi sebentar lagi ya.';
@endphp
@extends('errors._layout')

@section('actions')
  <button class="ed-btn ed-btn--primary" type="button" data-ed-reload>@include('errors._icons.reload') Coba lagi</button>
  <a class="ed-btn" href="{{ $home }}/">@include('errors._icons.home') Kembali ke Beranda</a>
  <button class="ed-btn" type="button" data-ed-back>@include('errors._icons.back') Kembali</button>
@endsection
