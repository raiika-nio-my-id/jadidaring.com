        <div class="clay-section__header">
            <div>
                <h1 class="clay-section__title">Katalog Game Daring</h1>
                <p style="color: var(--clay-ink-2); font-size: 15px; margin-top: 4px;">Mainkan aneka permainan peramban langsung tanpa instalasi.</p>
            </div>

            <div class="pills-bar" data-jd-chips style="margin-bottom: 0;" aria-label="Urutkan Game">
                <a href="/game?sort=views"
                   class="clay-pill clay-pill--peach @if($sort === 'views') is-active @endif"
                   @if($sort === 'views') aria-current="page" @endif>
                   Populer
                </a>
                <a href="/game?sort=new"
                   class="clay-pill clay-pill--peach @if($sort === 'new') is-active @endif"
                   @if($sort === 'new') aria-current="page" @endif>
                   Terbaru
                </a>
                <a href="/game?sort=az"
                   class="clay-pill clay-pill--peach @if($sort === 'az') is-active @endif"
                   @if($sort === 'az') aria-current="page" @endif>
                   A–Z
                </a>
            </div>
        </div>

