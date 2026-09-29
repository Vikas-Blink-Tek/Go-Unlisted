-- Migration: Add display_mode and cta_text columns to festival_offers
-- Run this on production DB before deploying the new code

-- Add cta_text column if missing
ALTER TABLE `festival_offers`
  ADD COLUMN IF NOT EXISTS `cta_text` VARCHAR(100) DEFAULT '' AFTER `link_url`;

-- Add display_mode column (default 'split' = image alongside text, never gets cropped)
ALTER TABLE `festival_offers`
  ADD COLUMN IF NOT EXISTS `display_mode` VARCHAR(20) DEFAULT 'split' AFTER `cta_text`;

-- Update existing offers that have images to use 'split' (safest mode)
UPDATE `festival_offers` SET `display_mode` = 'split' WHERE `display_mode` IS NULL OR `display_mode` = '';
