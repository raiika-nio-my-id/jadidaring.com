<?php

namespace App\Http\Controllers\Panel;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Services\Admin\AdminAudit;
use App\Services\Admin\AdminBackup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/** /admin Pesan: contact-form messages (ported from admin.jadidaring.com/messages). */
class MessageController extends Controller
{
    public function index(Request $request): View
    {
        $f = $request->query('f') === 'belum' ? 'belum' : 'semua';

        return view('panel.messages', [
            'messages' => ContactMessage::query()->when($f === 'belum', fn ($w) => $w->whereNull('read_at'))->orderByDesc('id')->paginate(20)->withQueryString(),
            'f' => $f,
        ]);
    }

    public function read(Request $request, int $message): RedirectResponse
    {
        $model = ContactMessage::query()->findOrFail($message);
        $model->forceFill(['read_at' => $model->read_at ?? now()])->save();
        AdminAudit::log($request, 'message.read', 'contact_message', $model->id, $model->subject);

        return back()->with('toast', 'Ditandai sudah dibaca.');
    }

    public function destroy(Request $request, int $message): RedirectResponse
    {
        $model = ContactMessage::query()->findOrFail($message);
        $file = AdminBackup::write('contact-message-'.$model->id, $model->toArray());
        $model->delete();
        AdminAudit::log($request, 'message.delete', 'contact_message', $message, $model->subject, ['backup' => basename($file)]);

        return back()->with('toast', 'Pesan dihapus.');
    }
}
