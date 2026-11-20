<?php

namespace App\Services\Admin;

use App\Models\AdminAuditLog;
use Illuminate\Http\Request;

/** Writes the admin audit trail. Every state-changing /admin action calls this. */
class AdminAudit
{
    /**
     * @param  array<string, mixed>  $meta
     */
    public static function log(Request $request, string $action, ?string $targetType = null, int|string|null $targetId = null, ?string $label = null, array $meta = []): AdminAuditLog
    {
        $user = $request->user();

        return AdminAuditLog::query()->create([
            'user_id' => $user?->id,
            'actor' => mb_substr((string) ($user?->email ?? $user?->username ?? 'unknown'), 0, 64),
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId === null ? null : (string) $targetId,
            'target_label' => $label === null ? null : mb_substr($label, 0, 191),
            'meta' => $meta === [] ? null : $meta,
            'ip' => $request->ip(),
        ]);
    }
}
