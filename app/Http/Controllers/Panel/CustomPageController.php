<?php

namespace App\Http\Controllers\Panel;

use App\Enums\ProfileStatus;
use App\Http\Controllers\Controller;
use App\Models\CompanyProfile;
use App\Models\CompanyProfileAlias;
use App\Rules\Subdomain;
use App\Services\Admin\AdminAudit;
use App\Services\SubdomainService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

/**
 * /admin Custom Page: standalone HTML pages at jadidaring.com/{slug}. Admin-only (panel.admin);
 * no owner account, no email/password. Never a GameHub entry: is_game is always false here.
 */
class CustomPageController extends Controller
{
    private function query()
    {
        return CompanyProfile::query()->where('is_game', false);
    }

    public function index(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));
        $pages = $this->query()->withCount('aliases')
            ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x->where('subdomain', 'like', '%'.$q.'%')->orWhere('name', 'like', '%'.$q.'%')))
            ->orderByDesc('is_pinned')->orderBy('sort_order')->orderBy('id')->get();

        return view('panel.pages.index', ['pages' => $pages, 'q' => $q]);
    }

    public function create(): View
    {
        return view('panel.pages.form', ['page' => new CompanyProfile(['status' => ProfileStatus::Draft, 'hide_footer' => false])]);
    }

    public function store(Request $request, SubdomainService $subdomains): RedirectResponse
    {
        $data = $this->validated($request);
        $data['subdomain'] = $subdomains->validateAvailable($data['subdomain']);

        $page = CompanyProfile::query()->create($data + [
            'user_id' => null, 'is_game' => false, 'is_pinned' => false,
            'sort_order' => (int) $this->query()->max('sort_order') + 1,
        ]);
        AdminAudit::log($request, 'page.create', 'company_profile', $page->id, $page->subdomain);

        return redirect()->route('panel.pages.edit', $page->id)->with('toast', 'Custom Page dibuat.');
    }

    public function edit(int $page): View
    {
        return view('panel.pages.form', ['page' => $this->query()->with('aliases')->findOrFail($page)]);
    }

    public function update(Request $request, int $page, SubdomainService $subdomains): RedirectResponse
    {
        $model = $this->query()->findOrFail($page);
        $data = $this->validated($request);
        $former = $model->subdomain;

        DB::transaction(function () use ($model, $data, $former, $subdomains): void {
            if (strtolower($data['subdomain']) !== strtolower($former)) {
                $data['subdomain'] = $subdomains->preparePrimaryChange($model, $data['subdomain']);
            } else {
                $data['subdomain'] = $former;
            }
            $model->update($data + ['is_game' => false]);
            if ($data['subdomain'] !== $former) {
                $subdomains->rememberFormerPrimary($model, $former);
            }
        });
        AdminAudit::log($request, 'page.update', 'company_profile', $model->id, $model->subdomain, ['from' => $former]);

        return redirect()->route('panel.pages.edit', $model->id)->with('toast', 'Custom Page disimpan.');
    }

    public function pin(Request $request, int $page): RedirectResponse
    {
        $model = $this->query()->findOrFail($page);
        $model->update(['is_pinned' => ! $model->is_pinned]);
        AdminAudit::log($request, $model->is_pinned ? 'page.pin' : 'page.unpin', 'company_profile', $model->id, $model->subdomain);

        return back()->with('toast', $model->is_pinned ? 'Dipin ke atas.' : 'Pin dilepas.');
    }

    /** Move one place up or down; renumbers the whole list so the order is always 1..n. */
    public function move(Request $request, int $page): RedirectResponse
    {
        $dir = $request->validate(['dir' => ['required', 'in:up,down']])['dir'];
        $ids = $this->query()->orderByDesc('is_pinned')->orderBy('sort_order')->orderBy('id')->pluck('id')->all();
        $i = array_search($page, $ids, true);
        abort_if($i === false, 404);
        $j = $dir === 'up' ? $i - 1 : $i + 1;

        if (isset($ids[$j])) {
            [$ids[$i], $ids[$j]] = [$ids[$j], $ids[$i]];
            DB::transaction(function () use ($ids): void {
                foreach ($ids as $pos => $id) {
                    CompanyProfile::query()->whereKey($id)->update(['sort_order' => $pos + 1]);
                }
            });
        }

        return back()->with('toast', 'Urutan disimpan.');
    }

    public function storeAlias(Request $request, int $page, SubdomainService $subdomains): RedirectResponse
    {
        $model = $this->query()->findOrFail($page);
        $raw = $request->validate(['alias' => ['required', 'string', 'max:63', new Subdomain]], [], ['alias' => 'alias'])['alias'];
        $alias = $subdomains->validateAvailableAlias($raw, $model);
        $model->aliases()->create(['subdomain' => $alias]);
        AdminAudit::log($request, 'page.alias.add', 'company_profile', $model->id, $model->subdomain, ['alias' => $alias]);

        return back()->with('toast', 'Alias '.$alias.' ditambahkan.');
    }

    public function destroyAlias(Request $request, int $page, int $alias): RedirectResponse
    {
        $model = $this->query()->findOrFail($page);
        $row = CompanyProfileAlias::query()->where('company_profile_id', $model->id)->findOrFail($alias);
        $row->delete();
        AdminAudit::log($request, 'page.alias.remove', 'company_profile', $model->id, $model->subdomain, ['alias' => $row->subdomain]);

        return back()->with('toast', 'Alias '.$row->subdomain.' dihapus.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'subdomain' => ['required', 'string', 'max:63', new Subdomain],
            'html' => ['required', 'string', 'max:2000000'],
            'status' => ['required', 'in:published,draft'],
            'expires_at' => ['nullable', 'date'],
            'hide_footer' => ['sometimes', 'boolean'],
        ], [], ['name' => 'nama', 'subdomain' => 'alamat', 'html' => 'HTML', 'expires_at' => 'kedaluwarsa']);
        $data['hide_footer'] = $request->boolean('hide_footer');
        $data['status'] = ProfileStatus::from($data['status']);
        $data['expires_at'] = $data['expires_at'] ?? null;

        return $data;
    }
}
