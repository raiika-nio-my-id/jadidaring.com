<div class="adm-sub" role="navigation" aria-label="Bagian komunitas">
    <a class="adm-chip" href="{{ route('panel.community') }}" @if(request()->routeIs('panel.community', 'panel.community.show')) aria-current="page" @endif>Profil member</a>
    <a class="adm-chip" href="{{ route('panel.community.comments') }}" @if(request()->routeIs('panel.community.comments')) aria-current="page" @endif>Komentar profil</a>
    <a class="adm-chip" href="{{ route('panel.community.posts') }}" @if(request()->routeIs('panel.community.posts')) aria-current="page" @endif>Curhatan</a>
</div>
