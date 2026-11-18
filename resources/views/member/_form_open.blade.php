@if ($errors->any())
    <ul class="clay-errors" role="alert">
        @foreach ($errors->all() as $error)
            <li>{{ $error }}</li>
        @endforeach
    </ul>
@endif
@if (session('status'))
    <p class="clay-status" role="status">{{ session('status') }}</p>
@endif
