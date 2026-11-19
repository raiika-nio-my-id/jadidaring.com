<?php

namespace App\Services\GoogleStats;

use RuntimeException;

/** A Google API failure reduced to a safe, user-facing category (details are logged server-side only). */
class GoogleStatsException extends RuntimeException
{
    public const CATEGORIES = [
        'izin' => 'Akses ditolak (403). Pastikan email service account sudah ditambahkan ke property dengan izin baca.',
        'api_nonaktif' => 'API belum diaktifkan di project Google Cloud milik service account.',
        'kunci' => 'Kunci service account ditolak Google. Periksa atau buat ulang kunci JSON-nya.',
        'tidak_ditemukan' => 'Property atau situs tidak ditemukan (404). Periksa ID property / alamat situs.',
        'kuota' => 'Batas kuota Google tercapai. Coba lagi beberapa saat lagi.',
        'jaringan' => 'Tidak bisa menghubungi server Google. Coba lagi nanti.',
        'lainnya' => 'Google mengembalikan error yang tidak dikenal.',
    ];

    public function __construct(public readonly string $category, string $logMessage = '')
    {
        parent::__construct($logMessage !== '' ? $logMessage : $category);
    }

    public function friendlyMessage(): string
    {
        return self::CATEGORIES[$this->category] ?? self::CATEGORIES['lainnya'];
    }
}
