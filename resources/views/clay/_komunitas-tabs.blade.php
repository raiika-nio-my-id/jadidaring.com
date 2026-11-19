<nav class="ch-tabs" data-jd-chips aria-label="Komunitas">
    <a href="/komunitas" class="ch-tab"@if ($tab === 'terbaru') aria-current="page"@endif>Terbaru</a>
    <a href="/komunitas?tab=mengikuti" class="ch-tab"@if ($tab === 'mengikuti') aria-current="page"@endif>Mengikuti</a>
    <a href="/komunitas?tab=profil" class="ch-tab"@if ($tab === 'profil') aria-current="page"@endif>Jelajah profil</a>
</nav>
