/* AvSec Portal — подключение Telegram Mini App SDK только при открытии из Telegram (с v217).
   SDK — своя копия vendor/telegram-web-app.js (снята с telegram.org 08.11.2026, SHA-256 124bdff7…3b5908), а не внешний адрес:
   внешний скрипт работал бы в том же origin, что и ключ данных. Признаки Mini App: параметры tgWebApp* в адресе,
   сохранённые SDK параметры в sessionStorage (перезагрузка внутри Telegram) или мост WebView. */
(function () {
  var inTg = false;
  try { inTg = /tgWebApp/.test(location.hash + location.search) || !!sessionStorage.getItem('__telegram__initParams') || !!window.TelegramWebviewProxy || !!window.external && 'notify' in window.external; } catch (e) {}
  if (inTg) document.write('<script src="vendor/telegram-web-app.js"><\/script>');
})();
