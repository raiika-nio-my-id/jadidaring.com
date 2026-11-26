<?php

namespace App\Http\Controllers;

use App\Models\ContactMessage;
use App\Services\TenantPath;
use App\Support\Ga4;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\View\View;

class PageController extends Controller
{
    /** path => last edited date (real content dates, used by the sitemap). */
    public const PAGES = [
        'tentang' => '2026-11-26',
        'kebijakan-redaksi' => '2026-11-26',
        'kebijakan-privasi' => '2026-11-19',
        'kontak' => '2026-11-19',
        'redaksi' => '2026-11-26',
        'kebijakan-koreksi' => '2026-11-26',
    ];

    public function tentang(): View
    {
        return $this->page('tentang', 'Tentang Jadidaring', 'Tentang Jadidaring: platform game web, berita, dan komunitas digital Indonesia.');
    }

    public function redaksi(): View
    {
        return $this->page('redaksi', 'Kebijakan Redaksi', 'Kebijakan redaksi Jadidaring: aturan sumber minimal dua media independen, koreksi, dan keterbukaan soal penulisan berbantuan AI.');
    }

    public function privasi(): View
    {
        return $this->page('privasi', 'Kebijakan Privasi', 'Kebijakan privasi Jadidaring: data apa yang dikumpulkan, cookie, dan cara menghubungi kami.');
    }

    public function timRedaksi(): View
    {
        return $this->page('tim-redaksi', 'Redaksi', 'Redaksi Jadidaring: pengelola situs, byline Redaksi Jaring, dan cara artikel berita disusun dengan bantuan AI.');
    }

    public function koreksi(): View
    {
        return $this->page('koreksi', 'Kebijakan Koreksi', 'Kebijakan koreksi Jadidaring: cara melaporkan kesalahan artikel dan bagaimana redaksi memperbaikinya.');
    }

    public function contact(): View
    {
        return $this->page('kontak', 'Kontak', 'Hubungi redaksi dan pengelola Jadidaring lewat formulir kontak.', ['started' => time()]);
    }

    public function send(Request $request): RedirectResponse
    {
        // Honeypot (hidden "website" field) and a minimum fill time quietly drop bots.
        if ($request->filled('website') || time() - (int) $request->input('t', 0) < 3) {
            return redirect('/kontak')->with('sent', true);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['nullable', 'email:rfc', 'max:150'],
            'subject' => ['required', 'string', 'min:3', 'max:150'],
            'message' => ['required', 'string', 'min:10', 'max:3000'],
        ]);

        if (preg_match_all('#https?://|www\.#i', $data['message']) > 3) {
            return back()->withInput()->withErrors(['message' => 'Terlalu banyak tautan di pesan.']);
        }

        $day = 'contact:'.sha1($request->ip().'|'.now()->toDateString());

        if (Cache::increment($day) > 10) {
            return back()->withInput()->withErrors(['message' => 'Terlalu banyak pesan hari ini. Coba lagi besok.']);
        }

        Cache::put($day, (int) Cache::get($day, 1), now()->endOfDay());

        ContactMessage::query()->create([
            'name' => strip_tags($data['name']), 'email' => $data['email'] ?? null, 'subject' => strip_tags($data['subject']),
            'message' => strip_tags($data['message']), 'ip_hash' => hash_hmac('sha256', (string) $request->ip(), (string) config('app.key')),
        ]);

        Ga4::flash('generate_lead', ['form' => 'contact']);

        return redirect('/kontak')->with('sent', true);
    }

    /** @param array<string, mixed> $extra */
    private function page(string $view, string $title, string $description, array $extra = []): View
    {
        $path = match ($view) {
            'redaksi' => 'kebijakan-redaksi',
            'privasi' => 'kebijakan-privasi',
            'tim-redaksi' => 'redaksi',
            'koreksi' => 'kebijakan-koreksi',
            default => $view,
        };

        return view('clay.page-'.$view, [
            'metaTitle' => $title.' — Jadidaring',
            'metaDescription' => $description,
            'canonicalUrl' => 'https://'.TenantPath::host().'/'.$path,
            'updated' => self::PAGES[$path],
        ] + $extra);
    }
}
