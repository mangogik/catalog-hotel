import React, { useState, useMemo } from "react"; // Added useMemo
import { usePage } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageSquareText } from "lucide-react"; // Import an icon

export default function Start() {
    const { props } = usePage();
    const errors = props.errors || {};
    const flashStatus = props.flash?.status || props.status;
    const [token, setToken] = useState("");

    // --- WhatsApp Link ---
    // Get phone number from .env or config (replace with your actual front office number)
    const frontOfficePhone = import.meta.env.VITE_FRONT_OFFICE_PHONE || "6281234567890"; // Example number
    const defaultMessage = useMemo(() => {
        return encodeURIComponent("Halo, saya ingin meminta access token untuk katalog layanan hotel via WhatsApp.");
    }, []);
    const whatsappLink = `https://wa.me/${frontOfficePhone}?text=${defaultMessage}`;
    // --- End WhatsApp Link ---

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
            <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5"> {/* Added border, shadow, adjusted spacing */}
                <div className="text-center"> {/* Center title */}
                    <h1 className="text-xl font-semibold text-gray-800">Masuk Katalog Layanan</h1>
                    <p className="text-sm text-slate-600 mt-1">
                        Masukkan <b>access token</b> booking Anda, atau gunakan tautan langsung dari WhatsApp.
                    </p>
                </div>

                {/* Display Flash Messages/Errors */}
                {flashStatus && (
                    <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800"> {/* Added styling */}
                        {/* <AlertTitle>Info</AlertTitle> */}
                        <AlertDescription>{flashStatus}</AlertDescription>
                    </Alert>
                )}
                {errors.token && (
                    <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800"> {/* Added styling */}
                        {/* <AlertTitle>Gagal</AlertTitle> */}
                        <AlertDescription>{errors.token}</AlertDescription>
                    </Alert>
                )}

                {/* Token Input Form */}
                <form method="POST" action={route('catalog.enter')} className="space-y-3"> {/* Use route helper */}
                    {/* CSRF token (ensure it's passed correctly from backend) */}
                    <input type="hidden" name="_token" value={props.csrf_token} />

                    <Input
                        name="token"
                        placeholder="Masukkan access token Anda di sini" // More descriptive placeholder
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        className="text-center" // Center text input
                        aria-label="Access Token"
                    />
                    <Button type="submit" className="w-full">
                        Lihat Katalog
                    </Button>
                </form>

                {/* Separator and WhatsApp Option */}
                <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-gray-200"></span> {/* Use gray-200 */}
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-slate-500">Atau</span>
                    </div>
                </div>

                <div className="text-center space-y-2">
                    <p className="text-sm text-slate-600">
                        Belum punya token? Minta via WhatsApp:
                    </p>
                    <Button
                        variant="outline" // Use outline style for secondary action
                        className="w-full border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 gap-2" // Green styling
                        asChild // Use asChild to make it a link
                    >
                        <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                            <MessageSquareText className="h-4 w-4" /> {/* Icon */}
                            Chat Front Office
                        </a>
                    </Button>
                </div>
            </div>
        </div>
    );
}