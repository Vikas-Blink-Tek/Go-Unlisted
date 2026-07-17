<?php
/**
 * Production credentials — run: bash scripts/build_zip.sh
 * GITIGNORED — baked into deploy zip.
 */
return [
    'site_url' => 'https://go-unlisted.com',

    'db' => [
        'host' => 'localhost',
        'user' => 'u192120061_admin',
        'pass' => 'Gounlisted@123',
        'name' => 'u192120061_unlisted',
    ],

    'smtp' => [
        'host' => 'smtp.hostinger.com',
        'port' => 465,
        'secure' => 'ssl',
        'user' => 'info@go-unlisted.com',
        'pass' => 'Gounlisted@123',
        'from' => 'info@go-unlisted.com',
    ],

    'admin' => [
        'email' => 'jgond1992@gmail.com',
        'password' => 'Gounlisted@123',
    ],
];
