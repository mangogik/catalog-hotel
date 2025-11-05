<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServiceQuestion extends Model
{
    use HasFactory;

    protected $table = 'service_questions';

    protected $fillable = [
        'service_id',
        'version',
        'is_active',
        'questions_json',
    ];

    protected $casts = [
        'questions_json' => 'array',
        'is_active' => 'boolean',
    ];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    /**
     * Create a new version of questions for the service
     */
    public static function createNewVersion($serviceId, $questions)
    {
        // Get the latest version
        $latestVersion = self::where('service_id', $serviceId)->max('version') ?? 0;
        
        // Deactivate all current versions
        self::where('service_id', $serviceId)->update(['is_active' => false]);
        
        // Create new version
        return self::create([
            'service_id' => $serviceId,
            'version' => $latestVersion + 1,
            'is_active' => true,
            'questions_json' => $questions,
        ]);
    }
}