# S3 Cloud.ru — настройка для PING MOOT

Чтобы фото постов и голосовые сообщения загружались в облако и не пропадали, на сервере в `.env` добавь (в папке приложения, например `/var/www/ping-moot`):

```env
# Object Storage (из панели Evolution: бакет bucket-7a286d → Object Storage API)
S3_ENDPOINT=https://s3.cloud.ru
S3_BUCKET=bucket-7a286d
S3_REGION=ru-central-1

# Ключ доступа (новый ключ из панели «Ключи доступа»).
# Key Secret впиши в S3_SECRET_KEY — он показывался один раз при создании ключа.
S3_ACCESS_KEY=357f5e7196fbd6f753ebbf7b98bad0bd
S3_SECRET_KEY=ключ_секрет_который_ты_сохранил
```

Если панель требует формат «ID тенанта / Key ID», попробуй:
`S3_ACCESS_KEY=baf59cb2-af71-40ed-a33c-0bab7821c6d9/357f5e7196fbd6f753ebbf7b98bad0bd`

После сохранения `.env` перезапусти приложение: `pm2 restart ping-moot`. Новые загрузки пойдут в бакет, старые файлы из `uploads/` останутся на диске (их в облако не переносим автоматически).
