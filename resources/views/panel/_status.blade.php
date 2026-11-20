@php $map = ['published' => ['Terbit', 'ok'], 'hidden' => ['Disembunyikan', 'bad'], 'draft' => ['Draft', 'warn']]; [$t, $tone] = $map[$s] ?? [$s, 'info']; @endphp
<span class="adm-badge adm-badge--{{ $tone }}">{{ $t }}</span>
