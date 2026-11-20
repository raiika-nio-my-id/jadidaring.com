@php
    $home = \App\Support\ErrorPage::home();
    $code = 404; $accent = 'lavender'; $mood = 'lost';
    $title = 'Waduh, halamannya nyasar';
    $pageTitle = 'Halaman tidak ditemukan';
    $lead = 'Halaman yang kamu cari nggak ada di jaring kami. Mungkin link-nya salah ketik, sudah pindah, atau memang sudah dihapus.';
    $tried = mb_strimwidth(rawurldecode((string) request()->getPathInfo()), 0, 80, '…');
@endphp
@extends('errors._layout')

@section('note')
  @if ($tried !== '/' && $tried !== '')
    <p class="ed-note">Alamat yang dicoba: <code>{{ $tried }}</code></p>
  @endif
  <form class="ed-search" action="{{ $home }}/berita" method="get" role="search">
    <label for="ed-q">Cari berita</label>
    <input id="ed-q" type="search" name="q" maxlength="80" placeholder="Cari berita di Jadidaring…" autocomplete="off">
    <button class="ed-btn" type="submit">@include('errors._icons.search') Cari</button>
  </form>
@endsection

@section('actions')
  <a class="ed-btn ed-btn--primary" href="{{ $home }}/">@include('errors._icons.home') Kembali ke Beranda</a>
  <button class="ed-btn" type="button" data-ed-back>@include('errors._icons.back') Kembali</button>
@endsection
