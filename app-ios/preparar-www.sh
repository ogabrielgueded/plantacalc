#!/usr/bin/env bash
# Copia o PlantaCalc do site (pasta acima) para www/, que vai dentro do app de iPhone.
# O app abre sem internet; conta, nuvem, IA e SINAPI usam a internet normalmente.
set -euo pipefail
cd "$(dirname "$0")"
SITE=..
rm -rf www && mkdir -p www/vendor
for f in app.html conta.html config.js site.css sinapi_mapa.json version.json termos.html privacidade.html excluir-conta.html; do cp "$SITE/$f" www/; done
cp -r "$SITE/img" www/img
# Supabase local (sem depender da CDN para abrir)
SUPA=https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js
curl -fsSL "$SUPA" -o www/vendor/supabase.min.js
for f in www/app.html www/conta.html; do
  sed -i.bak "s#$SUPA#vendor/supabase.min.js#g" "$f" && rm -f "$f.bak"
done
# Páginas fora do programa (conta, termos, privacidade): ocupam a tela toda no iPhone e
# deixam a faixa da hora/bateria em verde, sem o cabeçalho ficar por baixo dela.
for f in www/conta.html www/termos.html www/privacidade.html www/excluir-conta.html; do
  perl -0pi -e 's|<meta name="viewport" content="width=device-width,initial-scale=1">|<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">|; s|</head>|<style>body{border-top:env(safe-area-inset-top) solid #1f5f20}</style>\n</head>|' "$f"
done
# Sem a página de vendas: o "início" do app é o próprio PlantaCalc
cat > www/index.html <<'HTML'
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>PlantaCalc</title><style>html,body{margin:0;height:100%;background:#1f5f20}</style></head><body><script>location.replace('app.html');</script></body></html>
HTML
echo "www pronto: $(du -sh www | cut -f1)"
