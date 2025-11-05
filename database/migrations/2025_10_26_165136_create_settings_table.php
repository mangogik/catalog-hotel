<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();

            // Kunci unik untuk setiap setting (misal: 'hotel_name', 'hotel_logo_url')
            $table->string('key')->unique();

            // Nilai setting (bisa teks, angka, json string, dsb)
            $table->text('value')->nullable();

            // Jenis setting (untuk bantu UI): string, text, bool, image, json, secret, number
            $table->string('type')->default('string');

            // Grup setting (misal: branding, contact, automation)
            $table->string('group')->default('general');

            // Optional: deskripsi singkat tentang fungsi setting
            $table->string('description')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
