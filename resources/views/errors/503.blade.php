@php
    $home = \App\Support\ErrorPage::home();
    $code = 503; $accent = 'sky'; $mood = 'sleep';
    $title = 'Lagi beres-beres sebentar';
    $pageTitle = 'Sedang perawatan';
    $lead = 'Jadidaring sedang dalam perawatan supaya makin ngebut dan nyaman. Biasanya cuma beberapa menit, kok.';
    $headers = isset($exception) && method_exists($exception, 'getHeaders') ? $exception->getHeaders() : [];
    $retry = isset($headers['Retry-After']) && is_numeric($headers['Retry-After']) ? (int) $headers['Retry-After'] : null;
@endphp
@extends('errors._layout')

@section('note')
  <p class="ed-note" aria-live="polite">
    @if ($retry)
      Perkiraan kembali dalam sekitar {{ $retry >= 120 ? ceil($retry / 60).' menit' : $retry.' detik' }}. Halaman ini akan mencoba memuat ulang sendiri.
    @else
      Halaman ini akan mencoba memuat ulang sendiri setiap 30 detik.
    @endif
  </p>
@endsection

@section('actions')
  <button class="ed-btn ed-btn--primary" type="button" data-ed-reload>@include('errors._icons.reload') Muat ulang</button>
@endsection

@section('scripts')
<script>setTimeout(function(){location.reload();},{{ max(15, min($retry ?? 30, 600)) }}*1000);</script>
@endsection
