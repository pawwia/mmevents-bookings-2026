<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\App;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;

/**
 * CRM: katalogi personalizacji — animacje (nazwa, miniatura, link YouTube),
 * tła (zdjęcie, nazwa), szablony wydruków i wzory ksiąg gości (zdjęcie, nazwa, hashtagi).
 */
class AdminCatalogController
{
    private const TABLES = [
        'animations' => ['name', 'thumbnail_url', 'youtube_url', 'is_active', 'sort_order'],
        'backgrounds' => ['name', 'image_url', 'is_active', 'sort_order'],
        'print-templates' => ['name', 'image_url', 'is_active', 'sort_order'],
        'guestbook-designs' => ['name', 'image_url', 'is_active', 'sort_order'],
    ];

    /** Tabele z hashtagami: tabela → [pivot, kolumna klucza obcego]. */
    private const HASHTAG_PIVOTS = [
        'print_templates' => ['print_template_hashtag', 'print_template_id'],
        'guestbook_designs' => ['guestbook_design_hashtag', 'guestbook_design_id'],
    ];

    private function table(Request $request): ?string
    {
        $type = $request->params['type'] ?? '';
        return isset(self::TABLES[$type]) ? str_replace('-', '_', $type) : null;
    }

    public function index(Request $request): Response
    {
        $table = $this->table($request);
        if ($table === null) {
            return Response::notFound();
        }
        $rows = Database::select("SELECT * FROM `$table` ORDER BY sort_order, id");
        if (isset(self::HASHTAG_PIVOTS[$table])) {
            $this->attachHashtags($table, $rows);
        }
        return Response::json($rows);
    }

    public function store(Request $request): Response
    {
        $table = $this->table($request);
        if ($table === null) {
            return Response::notFound();
        }
        if (trim((string) $request->input('name', '')) === '') {
            return Response::error('Nazwa jest wymagana', 422);
        }
        $fields = array_intersect_key($request->all(), array_flip(self::TABLES[$request->params['type']]));
        $id = Database::insert($table, $fields);
        if (isset(self::HASHTAG_PIVOTS[$table])) {
            $this->syncHashtags($table, $id, (array) $request->input('hashtags', []));
        }
        return Response::json(Database::selectOne("SELECT * FROM `$table` WHERE id = ?", [$id]), 201);
    }

    public function update(Request $request): Response
    {
        $table = $this->table($request);
        $id = (int) $request->params['id'];
        if ($table === null || !Database::selectOne("SELECT id FROM `$table` WHERE id = ?", [$id])) {
            return Response::notFound();
        }
        $fields = array_intersect_key($request->all(), array_flip(self::TABLES[$request->params['type']]));
        if ($fields) {
            Database::update($table, $fields, 'id = ?', [$id]);
        }
        if (isset(self::HASHTAG_PIVOTS[$table]) && $request->input('hashtags') !== null) {
            $this->syncHashtags($table, $id, (array) $request->input('hashtags'));
        }
        return Response::json(Database::selectOne("SELECT * FROM `$table` WHERE id = ?", [$id]));
    }

    public function destroy(Request $request): Response
    {
        $table = $this->table($request);
        if ($table === null) {
            return Response::notFound();
        }
        $id = (int) $request->params['id'];
        // Skasuj plik graficzny z dysku (jeśli wgrany lokalnie) — zanim usuniemy rekord.
        $row = Database::selectOne("SELECT * FROM `$table` WHERE id = ?", [$id]);
        if ($row !== null) {
            self::deleteLocalFile($row['image_url'] ?? null);
            self::deleteLocalFile($row['thumbnail_url'] ?? null);
        }
        // Personalizacje mają ON DELETE SET NULL — usunięcie pozycji nie psuje rezerwacji.
        Database::execute("DELETE FROM `$table` WHERE id = ?", [$id]);
        return Response::json(['ok' => true]);
    }

    /** Usuwa plik z public/uploads na podstawie URL-a (pomija adresy zewnętrzne, np. YouTube). */
    public static function deleteLocalFile(?string $url): void
    {
        if ($url === null || $url === '') {
            return;
        }
        $pos = strpos($url, '/uploads/');
        if ($pos === false) {
            return; // URL spoza naszego katalogu uploadów — nie ruszamy
        }
        $rel = substr($url, $pos);
        if (str_contains($rel, '..')) {
            return; // zabezpieczenie przed path traversal
        }
        $path = App::basePath() . '/public' . $rel;
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private function attachHashtags(string $table, array &$rows): void
    {
        [$pivot, $fk] = self::HASHTAG_PIVOTS[$table];
        $tags = Database::select(
            "SELECT p.`$fk` AS item_id, h.name FROM `$pivot` p JOIN hashtags h ON h.id = p.hashtag_id"
        );
        $byItem = [];
        foreach ($tags as $tag) {
            $byItem[(int) $tag['item_id']][] = $tag['name'];
        }
        foreach ($rows as &$row) {
            $row['hashtags'] = $byItem[(int) $row['id']] ?? [];
        }
    }

    /** @param string[] $names np. ["wesele","rocznica"] — nieistniejące hashtagi są tworzone */
    private function syncHashtags(string $table, int $itemId, array $names): void
    {
        [$pivot, $fk] = self::HASHTAG_PIVOTS[$table];
        Database::execute("DELETE FROM `$pivot` WHERE `$fk` = ?", [$itemId]);
        foreach ($names as $name) {
            $name = ltrim(trim(mb_strtolower((string) $name)), '#');
            if ($name === '') {
                continue;
            }
            $tag = Database::selectOne('SELECT id FROM hashtags WHERE name = ?', [$name]);
            $tagId = $tag !== null ? (int) $tag['id'] : Database::insert('hashtags', ['name' => $name]);
            Database::execute(
                "INSERT IGNORE INTO `$pivot` (`$fk`, hashtag_id) VALUES (?, ?)",
                [$itemId, $tagId]
            );
        }
    }
}
