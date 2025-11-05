<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\Order;

class XenditController extends Controller
{
    /**
     * Menangani notifikasi webhook dari Xendit
     * URL: POST /xendit/notification
     */
    public function notification(Request $request)
    {
        // 1. Ambil Token Verifikasi dari header
        $headerToken = $request->header('x-callback-token');

        // 2. Ambil Token rahasia dari database Anda
        $secretToken = setting('xendit_callback_token');

        // 3. Validasi Token (SANGAT PENTING)
        if (!$headerToken || !$secretToken || $headerToken !== $secretToken) {
            Log::warning('⚠️ Xendit Webhook: Invalid callback token');
            return response()->json(['message' => 'Invalid token'], 403);
        }

        // 4. Ambil payload
        $payload = $request->all();
        $orderCode = $payload['external_id'] ?? null;
        $status = $payload['status'] ?? null;

        Log::info('📩 Xendit Notification', [
            'order_code' => $orderCode,
            'status'     => $status,
            'payload'    => $payload,
        ]);

        if (!$orderCode || !$status) {
            return response()->json(['message' => 'Bad payload'], 400);
        }

        // 5. Cari order berdasarkan order_code (external_id)
        $order = Order::where('order_code', $orderCode)->with('payments')->first();

        if (!$order) {
            Log::warning("⚠️ Xendit: Order not found for order_code: {$orderCode}");
            return response()->json(['message' => 'OK (order not found)'], 200);
        }

        // 6. Update Status
        try {
            // Hanya update jika status berubah
            if ($status === 'PAID' && $order->status !== 'paid') {

                $order->update(['status' => 'paid']);

                $payment = $order->payments()->latest()->first();
                if ($payment) {
                    $payment->update([
                        'status' => 'paid',
                        'paid_at' => now(), // Catat waktu lunas
                    ]);
                }

                Log::info("✅ Xendit: Order [{$order->id}] updated to PAID");

            } elseif ($status === 'EXPIRED' && $order->status === 'pending') {

                $order->update(['status' => 'failed']); // atau 'expired'

                $payment = $order->payments()->latest()->first();
                if ($payment) {
                    $payment->update(['status' => 'failed']);
                }

                Log::info("⚠️ Xendit: Order [{$order->id}] updated to FAILED/EXPIRED");
            }

            return response()->json(['message' => 'Notification processed'], 200);

        } catch (\Throwable $e) {
            Log::error('❌ Xendit Notification Error', [
                'error' => $e->getMessage(),
                'order_code' => $orderCode,
            ]);
            return response()->json(['message' => 'Internal Server Error'], 500);
        }
    }
}