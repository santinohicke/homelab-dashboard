# Guía de Fortalecimiento & Seguridad (Hardening)

Este documento detalla las medidas de seguridad implementadas a nivel de Sistema Operativo, Docker y Red para operar el servidor 24/7 de forma confiable.

---

## 1. Hardening de Acceso SSH (OpenSSH)
* **Autenticación Exclusiva por Llaves Ed25519**: Autenticación por contraseña deshabilitada.
* **Acceso Root Deshabilitado**: `PermitRootLogin no`.
* **Configuración aplicada en `/etc/ssh/sshd_config.d/hardening.conf`**:
  ```ini
  Port 22
  PermitRootLogin no
  PasswordAuthentication no
  PubkeyAuthentication yes
  KbdInteractiveAuthentication no
  X11Forwarding no
  MaxAuthTries 3
  ClientAliveInterval 300
  ClientAliveCountMax 2
  ```

---

## 2. Reglas de Firewall (UFW)
Política restrictiva: Denegar todo el tráfico entrante por defecto y autorizar únicamente los servicios esenciales:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Acceso SSH únicamente desde LAN y Tailscale
sudo ufw allow in on eth0 to any port 22 proto tcp
sudo ufw allow in on tailscale0 to any port 22 proto tcp

# Tráfico Web hacia el Reverse Proxy
sudo ufw allow in on eth0 to any port 80 proto tcp
sudo ufw allow in on eth0 to any port 443 proto tcp

# Consultas DNS para Pi-hole
sudo ufw allow in on eth0 to any port 53 proto udp
sudo ufw allow in on eth0 to any port 53 proto tcp

sudo ufw enable
```

---

## 3. Prevención de Ataques de Fuerza Bruta (Fail2ban)
* **Cárcel SSH (`sshd`)**: Monitorea `/var/log/auth.log`. Si una IP falla 3 intentos de autenticación en una ventana de 10 minutos, es bloqueada automáticamente mediante reglas dinámicas de iptables durante 48 horas.
* **Cárcel Web (`npm-badbots`)**: Escanea las peticiones 400/403/404 en el log de Nginx buscando intentos de exploiting automatizado (`.env`, `wp-login`, `xmlrpc`, phpmyadmin) y aplica un ban de 72 horas.

---

## 4. Cifrado TLS 1.3 & Certificados Wildcard
* Todos los servicios exigen transporte HTTPS con HSTS habilitado (`max-age=31536000`).
* Algoritmo de curva elíptica ECDSA (secp384r1) para optimizar el handshake criptográfico en hardware liviano.
* Cifrado Zero-Knowledge en Vaultwarden: las llaves de cifrado AES-256 nunca abandonan el dispositivo del cliente.
