<?php

declare(strict_types=1);

namespace App\Core;

final class Router
{
    /** @var array<int, array{method:string, pattern:string, regex:string, handler:array, middleware:array}> */
    private array $routes = [];

    public function add(string $method, string $pattern, array $handler, array $middleware = []): void
    {
        $regex = '#^' . preg_replace('/\{(\w+)\}/', '(?P<$1>[^/]+)', $pattern) . '$#';
        $this->routes[] = compact('method', 'pattern', 'regex', 'handler', 'middleware');
    }

    public function get(string $p, array $h, array $m = []): void    { $this->add('GET', $p, $h, $m); }
    public function post(string $p, array $h, array $m = []): void   { $this->add('POST', $p, $h, $m); }
    public function put(string $p, array $h, array $m = []): void    { $this->add('PUT', $p, $h, $m); }
    public function patch(string $p, array $h, array $m = []): void  { $this->add('PATCH', $p, $h, $m); }
    public function delete(string $p, array $h, array $m = []): void { $this->add('DELETE', $p, $h, $m); }

    public function dispatch(Request $request): Response
    {
        $pathExists = false;
        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $request->path, $matches)) {
                continue;
            }
            $pathExists = true;
            if ($route['method'] !== $request->method) {
                continue;
            }
            $request->params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);

            foreach ($route['middleware'] as $middlewareClass) {
                $result = (new $middlewareClass())->handle($request);
                if ($result instanceof Response) {
                    return $result;
                }
            }

            [$class, $action] = $route['handler'];
            return (new $class())->{$action}($request);
        }

        return $pathExists
            ? Response::error('Niedozwolona metoda HTTP', 405)
            : Response::notFound('Nie znaleziono endpointu');
    }
}
