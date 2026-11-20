@php
    $home = \App\Support\ErrorPage::home();
    $code = 419; $accent = 'sky'; $mood = 'worried';
    $title = 'Sesinya keburu kedaluwarsa';
    $pageTitle = 'Sesi kedaluwarsa';
    $lead = 'Halaman ini dibuka cukup lama, jadi demi keamanan formulirnya perlu disegarkan dulu. Muat ulang halaman, lalu kirim lagi ya.';
@endphp
@extends('errors._layout')

@section('note')
  <p class="ed-note">Tips: kalau tadi sedang mengetik panjang, salin dulu tulisanmu sebelum memuat ulang.</p>
@endsection

@section('actions')
  <button class="ed-btn ed-btn--primary" type="button" data-ed-reload>@include('errors._icons.reload') Muat ulang</button>
  <button class="ed-btn" type="button" data-ed-back>@include('errors._icons.back') Kembali</button>
  <a class="ed-btn" href="{{ $home }}/">@include('errors._icons.home') Beranda</a>
@endsection
