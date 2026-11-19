<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class ContactMessageController extends Controller
{
    public function index(): View
    {
        return view('admin.messages', ['messages' => ContactMessage::query()->orderByDesc('id')->paginate(30)]);
    }

    public function read(ContactMessage $message): RedirectResponse
    {
        $message->forceFill(['read_at' => $message->read_at ?? now()])->save();

        return back();
    }

    public function destroy(ContactMessage $message): RedirectResponse
    {
        $message->delete();

        return back();
    }
}
