#!/usr/bin/env bash
# Переключить активную developer directory на полный Xcode (нужно для сборки iOS).
# Запустить из корня проекта (не из mobile/): sudo bash scripts/use-xcode.sh
if [ -d /Applications/Xcode.app/Contents/Developer ]; then
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  echo "Готово. Теперь можно: npm run build:ios && npm run ios"
else
  echo "Xcode не найден в /Applications/Xcode.app. Установите Xcode из App Store."
  exit 1
fi
