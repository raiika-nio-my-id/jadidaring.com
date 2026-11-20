<?php

namespace App\Http\Controllers\Panel;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use Illuminate\Http\Request;
use Illuminate\View\View;

/** /admin Log: the audit trail of admin actions. Read-only. */
class LogController extends Controller
{
    public function index(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));

        return view('panel.log', [
            'logs' => AdminAuditLog::query()
                ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x->where('action', 'like', '%'.$q.'%')->orWhere('target_label', 'like', '%'.$q.'%')->orWhere('actor', 'like', '%'.$q.'%')))
                ->orderByDesc('id')->paginate(40)->withQueryString(),
            'q' => $q,
        ]);
    }
}
