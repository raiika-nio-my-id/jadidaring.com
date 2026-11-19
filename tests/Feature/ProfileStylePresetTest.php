<?php

namespace Tests\Feature;

use App\Services\ProfileConfig;
use Tests\TestCase;

class ProfileStylePresetTest extends TestCase
{
    public function test_catalog_has_twenty_one_with_default_and_required_styles(): void
    {
        $ids = array_column(ProfileConfig::styleCatalog(), 'id');
        $this->assertCount(21, $ids); // 20 presets + "bawaan"
        foreach (['bawaan', 'clay', 'glass', 'flat', 'cartoon'] as $id) {
            $this->assertContains($id, $ids);
        }
    }

    public function test_style_is_whitelisted_and_defaults(): void
    {
        $this->assertSame('bawaan', ProfileConfig::validate([])['theme']['style']);
        $this->assertSame('bawaan', ProfileConfig::validate(['theme' => ['style' => 'x"><script>']])['theme']['style']);
        $this->assertSame('neon', ProfileConfig::validate(['theme' => ['style' => 'neon']])['theme']['style']);
    }

    public function test_css_exposes_style_and_fonts(): void
    {
        $c = ProfileConfig::css(ProfileConfig::validate(['theme' => ['style' => 'cartoon']]));
        $this->assertSame('cartoon', $c['style']);
        $this->assertContains('Comic Neue', $c['styleFonts']);
        $this->assertStringContainsString('--pf-card-solid:#', $c['vars']);
    }

    public function test_colour_presets_do_not_carry_a_style(): void
    {
        foreach (ProfileConfig::presets() as $p) {
            $this->assertArrayNotHasKey('style', $p['theme']);
        }
    }
}
