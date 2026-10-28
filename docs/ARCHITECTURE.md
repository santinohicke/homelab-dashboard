# Arquitectura de Red & Topología del Homelab

Este documento describe en profundidad el diseño de red, el flujo de paquetes de datos y el modelo de segmentación utilizado en el Homelab.

---

## 1. Diagrama de Flujo de Datos

```mermaid
flowchart TD
    subgraph WAN ["WAN & Acceso Remoto"]
        Internet["Internet / Clientes Remotos"]
        Tailscale["Tailscale WireGuard Mesh (100.64.0.0/10)"]
    end

    subgraph LAN ["Red Local Residencial (192.168.1.0/24)"]
        Router["Router Gateway GPON (192.168.1.1)"]
        WiFiClients["Dispositivos Familiares (WiFi 5 GHz / 2.4 GHz)"]
        HostPC["Workstation / Notebook (Ethernet / WiFi)"]
    end

    subgraph Host ["Lenovo ThinkCentre M93p Tiny (192.168.1.100)"]
        UFW["Firewall UFW & Fail2ban"]
        PiHole["Pi-hole DNS (:53)"]

        subgraph DockerBridge ["Docker Virtual Bridge (172.20.0.0/16)"]
            NPM["Nginx Proxy Manager (:80 / :443)"]
            Dashboard["Homelab Dashboard Web (:3000)"]
            Vaultwarden["Vaultwarden Bóveda Cifrada (:8085)"]
            Kuma["Uptime Kuma SLA Monitor (:3001)"]
            Portainer["Portainer CE (:9443)"]
        end

        subgraph HostNet ["Docker Host Network Mode"]
            HA["Home Assistant (:8123)"]
        end
    end

    Internet -->|Ingress Cifrado WireGuard| Tailscale
    Tailscale --> UFW
    WiFiClients -->|DNS Queries :53| PiHole
    HostPC -->|Tráfico LAN HTTP/S :443| NPM
    Router -->|Enlace Gigabit Cat6| UFW

    UFW --> NPM
    PiHole -->|Resolución Local *.homelab.local| NPM
    NPM -->|Ruteo Interno Proxy| Dashboard
    NPM -->|Ruteo Interno Proxy| Vaultwarden
    NPM -->|Ruteo Interno Proxy| Kuma
    NPM -->|Ruteo Interno Proxy| Portainer
    NPM -->|Ruteo Interno Proxy| HA
```

---

## 2. Segmentación de Red

| Red / Subred | Tipo | Propósito | Rango de IPs |
| :--- | :--- | :--- | :--- |
| **LAN Primaria** | Física (Cat6 / 802.11ac) | Dispositivos del hogar y servidor físico | `192.168.1.0/24` |
| **Docker Bridge** | Virtual (Bridge) | Aislamiento entre contenedores de infraestructura | `172.20.0.0/16` |
| **Tailscale Mesh** | Overlay (WireGuard) | Conexión remota cifrada punto a punto sin abrir puertos WAN | `100.64.0.0/10` |

---

## 3. Resolución de Nombres (DNS Split-Horizon)
* **Localmente**: Pi-hole intercepta consultas DNS para `*.homelab.local` y responde directamente con la IP interna del servidor (`192.168.1.100`), evitando loopback routing innecesario en el router.
* **Remotamente**: Tailscale MagicDNS resuelve el nombre de host de la máquina (`homelab-node-01.tailscale.net`) dentro de la VPN WireGuard.
