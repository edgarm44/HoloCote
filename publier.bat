@echo off
cd /d "%~dp0"
echo Publication de HoloCote...
git add -A
git diff --cached --quiet || git commit -m "Mise a jour du site"
git push
echo.
echo Termine. Le site sera a jour dans 2 minutes : https://edgarm44.github.io/HoloCote/
pause
