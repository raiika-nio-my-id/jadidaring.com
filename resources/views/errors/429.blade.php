@php
    $home = \App\Support\ErrorPage::home();
    $code = 429; $accent = 'mint'; $mood = 'dizzy';
    $title = 'Pelan-pelan, jaringnya kepenuhan';
    $pageTitle = 'Terlalu banyak permintaan';
    $lead = 'Kamu mengirim terlalu banyak permintaan dalam waktu singkat. Tarik napas sebentar, lalu coba lagi.';
    $wait = (int) ($retryAfter ?? (isset($exception) && method_exists($exception, 'getHeaders') ? ($exception->getHeaders()['Retry-After'] ?? 30) : 30));
    $wait = max(1, min($wait, 3600));
@endphp
@extends('errors._layout')

@section('note')
  <p class="ed-note" id="ed-wait" data-wait="{{ $wait }}" aria-live="polite">Coba lagi dalam sekitar <strong data-ed-count>{{ $wait }}</strong> detik.</p>
@endsection

@section('actions')
  <button class="ed-btn ed-btn--primary" type="button" data-ed-reload>@include('errors._icons.reload') Coba lagi</button>
  <a class="ed-btn" href="{{ $home }}/">@include('errors._icons.home') Kembali ke Beranda</a>
@endsection

@section('scripts')
<script>
(function(){var n=document.getElementById('ed-wait');if(!n){return;}var s=parseInt(n.getAttribute('data-wait'),10)||30;var c=n.querySelector('[data-ed-count]');
var t=setInterval(function(){s--;if(s<=0){clearInterval(t);n.textContent='Sudah boleh dicoba lagi sekarang.';return;}c.textContent=s;},1000);})();
</script>
@endsection
