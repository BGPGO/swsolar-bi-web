# Coolify deploy — serve estática BI via nginx (mais previsível que Caddy
# no setup do Coolify; veja issue de "exited:unhealthy" com caddy:2-alpine).
#
# Arquivos obrigatórios (sempre gerados por build-data.cjs + build-jsx.cjs):
#   index.html, styles.css, data.js, app.bundle.js, nginx.conf
#
# Arquivos opcionais que cliente PODE não ter — placeholder gerado pelo
# bgp-bi.cjs init (vazio) pra COPY não falhar:
#   data-extras.js, saldos.json, assets/
#
# Reports IA pré-gerados (report*.json) NÃO são copiados aqui — são gerados
# on-the-fly via backend ai-proxy. Cliente que cacheia local: adicionar COPYs.

FROM nginx:alpine

# Obrigatórios
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY data.js /usr/share/nginx/html/
COPY app.bundle.js /usr/share/nginx/html/

# Opcionais
COPY data-extras.js /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets

# Reports IA pré-gerados
COPY report*.json /usr/share/nginx/html/

# Config nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
