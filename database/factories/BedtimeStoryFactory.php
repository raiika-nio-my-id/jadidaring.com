<?php

namespace Database\Factories;

use App\Models\BedtimeStory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<BedtimeStory>
 */
class BedtimeStoryFactory extends Factory
{
    protected $model = BedtimeStory::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = fake()->sentence(4);

        return [
            'title' => $title,
            'slug' => Str::slug($title).'-'.fake()->unique()->randomNumber(4),
            'author' => fake()->name(),
            'author_origin' => fake()->city().', '.fake()->year(),
            'adapter' => 'Dongeng Anak Kecil',
            'language' => 'en',
            'summary' => fake()->sentence(10),
            'body' => fake()->paragraphs(3, true),
            'moral' => fake()->sentence(),
            'status' => 'draft',
            'published_at' => null,
        ];
    }

    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'published',
            'published_at' => now()->subMinutes(fake()->numberBetween(1, 1000)),
        ]);
    }

    public function draft(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'draft',
            'published_at' => null,
        ]);
    }
}
