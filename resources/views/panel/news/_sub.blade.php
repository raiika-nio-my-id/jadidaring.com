<div class="adm-sub" role="navigation" aria-label="Bagian berita">
    <a class="adm-chip" href="{{ route('panel.news') }}" @if(request()->routeIs('panel.news', 'panel.news.edit')) aria-current="page" @endif>Artikel</a>
    <a class="adm-chip" href="{{ route('panel.news.comments') }}" @if(request()->routeIs('panel.news.comments')) aria-current="page" @endif>Komentar berita</a>
    <a class="adm-chip" href="{{ route('panel.news.topics') }}" @if(request()->routeIs('panel.news.topics')) aria-current="page" @endif>Topik</a>
</div>
