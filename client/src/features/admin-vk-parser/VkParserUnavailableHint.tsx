/**
 * Текст, когда платформа не достучалась до PARSER — без жаргона для человека без доступа к серверу.
 */
export function VkParserUnavailableHint() {
  return (
    <div className="text-xs text-muted-foreground mt-1 space-y-2 leading-relaxed">
      <p>
        Сайт не получает ответ от отдельной программы на сервере, которая скачивает посты из ВКонтакте. Это не из‑за
        вашего токена или настроек привязки.
      </p>
      <p className="text-foreground/90 font-medium text-[13px]">Что сделать</p>
      <ol className="list-decimal pl-4 space-y-1.5 marker:text-muted-foreground">
        <li>Проверьте интернет и нажмите «Повторить».</li>
        <li>
          Если ошибка не исчезает — покажите этот экран администратору сайта или хостинга: нужно запустить и проверить
          сервис импорта ВК на сервере (он настраивается отдельно от этой страницы).
        </li>
      </ol>
    </div>
  );
}
