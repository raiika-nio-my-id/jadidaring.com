<?php

namespace App\Http\Controllers\Panel;

use App\Http\Controllers\Controller;
use App\Models\BedtimeStory;
use App\Services\Admin\AdminAudit;
use App\Services\Admin\AdminBackup;
use App\Services\BedtimeCache;
use App\Services\BedtimeImage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class BedtimeStoryController extends Controller
{
    public const LICENSES = [
        'CC0',
        'Domain publik',
        'CC BY 4.0',
        'CC BY-SA 4.0',
        'Unsplash License',
        'Pexels License',
        'Pixabay License',
        'Foto sendiri (Jadidaring)',
    ];

    public function index(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));
        $status = (string) $request->query('status', '');

        $stories = BedtimeStory::query()
            ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x->where('title', 'like', '%'.$q.'%')->orWhere('slug', 'like', '%'.$q.'%')->orWhere('author', 'like', '%'.$q.'%')))
            ->when(in_array($status, BedtimeStory::STATUSES, true), fn ($w) => $w->where('status', $status))
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();

        return view('panel.bedtime.index', [
            'stories' => $stories,
            'q' => $q,
            'status' => $status,
            'statusCounts' => BedtimeStory::query()->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status'),
        ]);
    }

    public function create(): View
    {
        return view('panel.bedtime.create', [
            'licenses' => self::LICENSES,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:160'],
            'slug' => ['nullable', 'string', 'max:160', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:bedtime_stories,slug'],
            'author' => ['required', 'string', 'min:2', 'max:120'],
            'author_origin' => ['nullable', 'string', 'max:120'],
            'adapter' => ['nullable', 'string', 'max:120'],
            'language' => ['required', 'string', 'in:en,id'],
            'summary' => ['nullable', 'string', 'max:300'],
            'body' => ['required', 'string', 'max:20000'],
            'moral' => ['nullable', 'string', 'max:2000'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:12288', 'dimensions:min_width=1200,min_height=630'],
            'image_url' => ['nullable', 'url:https', 'max:500'],
            'image_alt' => ['nullable', 'string', 'max:200'],
            'image_credit' => ['nullable', 'string', 'max:200'],
            'image_license' => ['nullable', 'string', 'max:100'],
            'image_source_url' => ['nullable', 'url:https', 'max:500'],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'published_at' => ['nullable', 'date'],
        ]);

        if (strip_tags($data['body']) !== $data['body']) {
            throw ValidationException::withMessages(['body' => 'Tag HTML tidak diizinkan di dalam isi cerita.']);
        }

        $hasPhoto = $request->hasFile('image') || ! empty($data['image_url']);

        if ($hasPhoto && empty($data['image_credit'])) {
            throw ValidationException::withMessages(['image_credit' => 'Kredit foto wajib diisi bila foto diunggah atau URL diberikan.']);
        }

        $slug = ! empty($data['slug']) ? $data['slug'] : self::uniqueSlug($data['title']);
        $status = $data['status'];
        $publishedAt = $status === 'published' ? ($data['published_at'] ?? now()) : null;
        $adapter = ! empty($data['adapter']) ? $data['adapter'] : 'Dongeng Anak Kecil';

        $story = BedtimeStory::query()->create([
            'title' => $data['title'],
            'slug' => $slug,
            'author' => $data['author'],
            'author_origin' => $data['author_origin'] ?? null,
            'adapter' => $adapter,
            'language' => $data['language'],
            'summary' => $data['summary'] ?? null,
            'body' => $data['body'],
            'moral' => $data['moral'] ?? null,
            'status' => $status,
            'published_at' => $publishedAt,
        ]);

        if ($request->hasFile('image')) {
            $binary = (string) file_get_contents($request->file('image')->getRealPath());
            BedtimeImage::storePhoto($story, $binary, [
                'alt' => $data['image_alt'] ?? $story->title,
                'credit' => (string) $data['image_credit'],
                'source_url' => $data['image_source_url'] ?? null,
                'license' => $data['image_license'] ?? null,
            ]);
        } elseif (! empty($data['image_url'])) {
            try {
                $binary = BedtimeImage::download($data['image_url']);
                BedtimeImage::storePhoto($story, $binary, [
                    'alt' => $data['image_alt'] ?? $story->title,
                    'credit' => (string) $data['image_credit'],
                    'source_url' => $data['image_source_url'] ?? $data['image_url'],
                    'license' => $data['image_license'] ?? null,
                ]);
            } catch (\InvalidArgumentException $e) {
                // Keep story but report photo error
            }
        }

        BedtimeCache::bump();
        AdminAudit::log($request, 'bedtime.create', 'bedtime_story', $story->id, $story->title);

        return redirect()->route('panel.bedtime.edit', $story->id)->with('toast', 'Cerita berhasil disimpan.');
    }

    public function edit(int $bedtimeStory): View
    {
        $story = BedtimeStory::query()->findOrFail($bedtimeStory);

        return view('panel.bedtime.edit', [
            'story' => $story,
            'licenses' => self::LICENSES,
        ]);
    }

    public function update(Request $request, int $bedtimeStory): RedirectResponse
    {
        $story = BedtimeStory::query()->findOrFail($bedtimeStory);

        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:160'],
            'slug' => ['required', 'string', 'max:160', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:bedtime_stories,slug,'.$story->id],
            'author' => ['required', 'string', 'min:2', 'max:120'],
            'author_origin' => ['nullable', 'string', 'max:120'],
            'adapter' => ['nullable', 'string', 'max:120'],
            'language' => ['required', 'string', 'in:en,id'],
            'summary' => ['nullable', 'string', 'max:300'],
            'body' => ['required', 'string', 'max:20000'],
            'moral' => ['nullable', 'string', 'max:2000'],
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:12288', 'dimensions:min_width=1200,min_height=630'],
            'image_url' => ['nullable', 'url:https', 'max:500'],
            'image_alt' => ['nullable', 'string', 'max:200'],
            'image_credit' => ['nullable', 'string', 'max:200'],
            'image_license' => ['nullable', 'string', 'max:100'],
            'image_source_url' => ['nullable', 'url:https', 'max:500'],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'published_at' => ['nullable', 'date'],
        ]);

        if (strip_tags($data['body']) !== $data['body']) {
            throw ValidationException::withMessages(['body' => 'Tag HTML tidak diizinkan di dalam isi cerita.']);
        }

        $hasNewPhoto = $request->hasFile('image') || ! empty($data['image_url']);
        $hasExistingPhoto = (bool) $story->image_path;

        if (($hasNewPhoto || $hasExistingPhoto) && empty($data['image_credit'])) {
            throw ValidationException::withMessages(['image_credit' => 'Kredit foto wajib diisi bila ada foto.']);
        }

        $story->fill([
            'title' => $data['title'],
            'slug' => $data['slug'],
            'author' => $data['author'],
            'author_origin' => $data['author_origin'] ?? null,
            'adapter' => ! empty($data['adapter']) ? $data['adapter'] : 'Dongeng Anak Kecil',
            'language' => $data['language'],
            'summary' => $data['summary'] ?? null,
            'body' => $data['body'],
            'moral' => $data['moral'] ?? null,
            'status' => $data['status'],
            'published_at' => $data['status'] === 'published' ? ($data['published_at'] ?? $story->published_at ?? now()) : null,
            'image_alt' => $data['image_alt'] ?? $story->image_alt,
            'image_credit' => $data['image_credit'] ?? $story->image_credit,
            'image_license' => $data['image_license'] ?? $story->image_license,
            'image_source_url' => $data['image_source_url'] ?? $story->image_source_url,
        ]);

        if ($request->hasFile('image')) {
            $binary = (string) file_get_contents($request->file('image')->getRealPath());
            BedtimeImage::storePhoto($story, $binary, [
                'alt' => $data['image_alt'] ?? $story->title,
                'credit' => (string) $data['image_credit'],
                'source_url' => $data['image_source_url'] ?? null,
                'license' => $data['image_license'] ?? null,
            ]);
        } elseif (! empty($data['image_url'])) {
            try {
                $binary = BedtimeImage::download($data['image_url']);
                BedtimeImage::storePhoto($story, $binary, [
                    'alt' => $data['image_alt'] ?? $story->title,
                    'credit' => (string) $data['image_credit'],
                    'source_url' => $data['image_source_url'] ?? $data['image_url'],
                    'license' => $data['image_license'] ?? null,
                ]);
            } catch (\InvalidArgumentException $e) {
                // keep story update
            }
        }

        $changed = array_keys($story->getDirty());
        $story->save();
        BedtimeCache::bump();
        AdminAudit::log($request, 'bedtime.update', 'bedtime_story', $story->id, $story->title, ['fields' => $changed]);

        return redirect()->route('panel.bedtime.edit', $story->id)->with('toast', 'Cerita disimpan.');
    }

    public function status(Request $request, int $bedtimeStory): RedirectResponse
    {
        $story = BedtimeStory::query()->findOrFail($bedtimeStory);
        $data = $request->validate(['status' => ['required', Rule::in(['published', 'draft'])]]);

        if ($data['status'] === 'published') {
            $story->published_at ??= now();
        }

        $story->status = $data['status'];
        $story->save();
        BedtimeCache::bump();
        AdminAudit::log($request, $data['status'] === 'published' ? 'bedtime.publish' : 'bedtime.hide', 'bedtime_story', $story->id, $story->title);

        return back()->with('toast', $data['status'] === 'published' ? 'Cerita diterbitkan di situs.' : 'Cerita disimpan sebagai draft.');
    }

    public function destroy(Request $request, int $bedtimeStory): RedirectResponse
    {
        $story = BedtimeStory::query()->findOrFail($bedtimeStory);
        $request->validate(['confirm' => ['required', 'in:HAPUS']], ['confirm.in' => 'Ketik HAPUS untuk konfirmasi.']);

        $file = AdminBackup::write('bedtime-story-'.$story->id, $story->toArray());
        $title = $story->title;
        BedtimeImage::clearPhoto($story);
        $story->delete();
        BedtimeCache::bump();
        AdminAudit::log($request, 'bedtime.delete', 'bedtime_story', $bedtimeStory, $title, ['backup' => basename($file)]);

        return redirect()->route('panel.bedtime')->with('toast', 'Cerita dihapus. Backup: '.basename($file));
    }

    private static function uniqueSlug(string $title, ?int $ignoreId = null): string
    {
        $base = Str::slug($title);
        $base = substr($base, 0, 100);
        $slug = $base !== '' ? $base : 'bedtime-story';

        while (BedtimeStory::query()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->exists()) {
            $slug = $base.'-'.Str::lower(Str::random(5));
        }

        return $slug;
    }
}
