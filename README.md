# Tutor Scheduler

Онлайн-расписание для репетитора. Уроки фиксированные по одному часу, вход выполняется через Supabase Auth.

## Локальный запуск

```bash
npm install
npm run dev
```

## Supabase

1. Создай проект в Supabase.
2. Открой SQL Editor и выполни `supabase/schema.sql`.
3. Скопируй `.env.example` в `.env.local`.
4. Заполни:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

После перезапуска dev-сервера приложение перейдет из локального режима в онлайн-сохранение.

## Авторизация

1. В Supabase открой Authentication -> Users.
2. Создай пользователя с email и паролем.
3. Используй этот email и пароль на экране входа.

Правила в `supabase/schema.sql` разрешают читать и менять расписание только пользователям с активной Supabase-сессией.
