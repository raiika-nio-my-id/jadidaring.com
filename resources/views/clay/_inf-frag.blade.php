{{-- Fragment for ?partial=1: only the next batch of cards, then the new footer. Needs $kind (news|game|profile), $inf and the batch data. --}}
@if ($kind === 'news')
    @include('clay._news-cards', ['articles' => $articles])
@elseif ($kind === 'game')
    @include('clay._game-cards', ['games' => $games, 'sort' => $sort])
@elseif ($kind === 'bedtime')
    @include('clay._bedtime-cards', ['stories' => $stories])
@else
    @include('clay._profile-cards', ['pages' => $pages])
@endif
@include('clay._inf-more', ['inf' => $inf])
