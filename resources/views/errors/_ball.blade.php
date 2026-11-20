{{-- Clay "jaring" ball mascot. $mood: lost|locked|worried|dizzy|oops|sleep|meh --}}
@php($mood = $mood ?? 'meh')
<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="edBallFill" cx="36%" cy="30%" r="75%">
      <stop offset="0" style="stop-color:#fff;stop-opacity:.9"/>
      <stop offset=".22" style="stop-color:var(--ed-ball)"/>
      <stop offset="1" style="stop-color:var(--ed-ball-2)"/>
    </radialGradient>
    <clipPath id="edBallClip"><circle cx="50" cy="50" r="45"/></clipPath>
  </defs>
  <circle cx="50" cy="50" r="45" fill="url(#edBallFill)"/>
  <g clip-path="url(#edBallClip)" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="1.6">
    <path d="M50 5 C30 25 30 75 50 95"/><path d="M50 5 C70 25 70 75 50 95"/>
    <path d="M50 5 C12 25 12 75 50 95"/><path d="M50 5 C88 25 88 75 50 95"/>
    <path d="M5 34 Q50 46 95 34"/><path d="M5 66 Q50 78 95 66"/>
  </g>
  <ellipse cx="34" cy="22" rx="11" ry="6" fill="#fff" opacity=".55" transform="rotate(-24 34 22)"/>
  <g fill="#2B2440" stroke="#2B2440" stroke-linecap="round" stroke-linejoin="round">
  @switch($mood)
    @case('lost')
      <ellipse cx="38" cy="50" rx="7" ry="8" fill="#fff" stroke="none"/><ellipse cx="64" cy="50" rx="7" ry="8" fill="#fff" stroke="none"/>
      <circle cx="41" cy="51" r="3.6" stroke="none"/><circle cx="67" cy="51" r="3.6" stroke="none"/>
      <ellipse cx="53" cy="68" rx="4" ry="5" stroke="none"/>
      @break
    @case('locked')
      <path d="M31 50 h12 M57 50 h12" fill="none" stroke-width="3.4"/>
      <path d="M43 68 h14" fill="none" stroke-width="3.4"/>
      <rect x="66" y="62" width="16" height="13" rx="3" fill="#FFD25E" stroke="#2B2440" stroke-width="2"/>
      <path d="M69.5 62 v-4 a4.5 4.5 0 0 1 9 0 v4" fill="none" stroke-width="2.4"/>
      @break
    @case('worried')
      <path d="M30 40 l10 -4 M70 40 l-10 -4" fill="none" stroke-width="3"/>
      <circle cx="37" cy="51" r="4" stroke="none"/><circle cx="63" cy="51" r="4" stroke="none"/>
      <path d="M38 70 q4 -4 8 0 q4 4 8 0 q4 -4 8 0" fill="none" stroke-width="3"/>
      <path d="M77 30 q4 7 0 10 q-4 -3 0 -10z" fill="#8CC8F2" stroke="none"/>
      @break
    @case('dizzy')
      <path d="M37 50 m-6 0 a6 6 0 1 1 6 6 a3.5 3.5 0 1 1 3.5 -3.5" fill="none" stroke-width="2.6"/>
      <path d="M63 50 m-6 0 a6 6 0 1 1 6 6 a3.5 3.5 0 1 1 3.5 -3.5" fill="none" stroke-width="2.6"/>
      <ellipse cx="50" cy="69" rx="6" ry="4.5" stroke="none"/>
      @break
    @case('oops')
      <path d="M32 44 l10 10 M42 44 l-10 10 M58 44 l10 10 M68 44 l-10 10" fill="none" stroke-width="3.4"/>
      <path d="M36 70 q3.5 -4 7 0 q3.5 4 7 0 q3.5 -4 7 0 q3.5 4 7 0" fill="none" stroke-width="3"/>
      <path d="M79 22 l-5 9 h6 l-5 9" fill="none" stroke="#FFD25E" stroke-width="3"/>
      @break
    @case('sleep')
      <path d="M31 50 q6 6 12 0 M57 50 q6 6 12 0" fill="none" stroke-width="3.2"/>
      <ellipse cx="50" cy="67" rx="3.5" ry="2.5" stroke="none"/>
      <text x="72" y="26" font-family="Baloo 2,Nunito,sans-serif" font-weight="800" font-size="16" fill="#2B2440" stroke="none">z</text>
      <text x="82" y="14" font-family="Baloo 2,Nunito,sans-serif" font-weight="800" font-size="11" fill="#2B2440" stroke="none">z</text>
      @break
    @default
      <circle cx="37" cy="50" r="4" stroke="none"/><circle cx="63" cy="50" r="4" stroke="none"/>
      <path d="M42 68 h16" fill="none" stroke-width="3.2"/>
  @endswitch
  </g>
  <ellipse cx="26" cy="60" rx="5" ry="3" fill="#FF7FA8" opacity=".45"/><ellipse cx="74" cy="60" rx="5" ry="3" fill="#FF7FA8" opacity=".45"/>
</svg>
