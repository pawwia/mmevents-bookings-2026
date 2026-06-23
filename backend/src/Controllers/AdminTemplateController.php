<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;

/** CRM: edycja treści e-mail i SMS (z obsługą zmiennych {{...}}). */
class AdminTemplateController
{
    public function emailIndex(Request $request): Response
    {
        return Response::json(Database::select('SELECT * FROM email_templates ORDER BY name'));
    }

    public function emailUpdate(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $fields = array_intersect_key($request->all(), array_flip(['subject', 'body', 'is_active']));
        if ($fields) {
            Database::update('email_templates', $fields, 'id = ?', [$id]);
        }
        return Response::json(Database::selectOne('SELECT * FROM email_templates WHERE id = ?', [$id]));
    }

    public function smsIndex(Request $request): Response
    {
        return Response::json(Database::select('SELECT * FROM sms_templates ORDER BY name'));
    }

    public function smsUpdate(Request $request): Response
    {
        $id = (int) $request->params['id'];
        $fields = array_intersect_key($request->all(), array_flip(['body', 'is_active']));
        if (isset($fields['body']) && mb_strlen((string) $fields['body']) > 500) {
            return Response::error('Treść SMS może mieć maks. 500 znaków', 422);
        }
        if ($fields) {
            Database::update('sms_templates', $fields, 'id = ?', [$id]);
        }
        return Response::json(Database::selectOne('SELECT * FROM sms_templates WHERE id = ?', [$id]));
    }
}
