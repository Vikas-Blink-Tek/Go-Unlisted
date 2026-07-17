<?php
/**
 * Template — copy to deploy.config.php and fill REPLACE_HPANEL_* from hPanel → Databases.
 */
return [
    'site_url' => 'https://go-unlisted.com',
    'db' => [
        'host' => 'localhost',
        'user' => 'REPLACE_HPANEL_DB_USER',
        'pass' => 'Gounlisted@123',
        'name' => 'REPLACE_HPANEL_DB_NAME',
    ],
    'smtp' => [
        'host' => 'smtp.hostinger.com',
        'port' => 465,
        'secure' => 'ssl',
        'user' => 'info@go-unlisted.com',
        'pass' => 'YOUR_EMAIL_PASSWORD',
        'from' => 'info@go-unlisted.com',
    ],
    'admin' => [
        'email' => 'jgond1992@gmail.com',
        'password' => 'Gounlisted@123',
    ],
];
