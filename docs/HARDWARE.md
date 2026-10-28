# Especificaciones Técnicas del Hardware & Consumo

El Homelab está construido sobre una estación de trabajo de factor de forma ultracompacto (USFF - Ultra Small Form Factor), seleccionada específicamente por su equilibrio entre confiabilidad corporativa, silencio térmico y mínimo consumo eléctrico.

---

## 1. Ficha Técnica

| Componente | Especificación Detallada |
| :--- | :--- |
| **Modelo** | Lenovo ThinkCentre M93p Tiny (USFF) |
| **Procesador (CPU)** | Intel® Core™ i5-4570T @ 2.90 GHz (Turbo 3.60 GHz, 2 Cores / 4 Threads) |
| **Memoria (RAM)** | 16 GB DDR3L Dual-Channel (1600 MHz) |
| **Almacenamiento (SSD)** | 240 GB Kingston A400 SSD SATA III (6 Gbps) |
| **Interfaz de Red (NIC)** | Intel® I217-LM Gigabit Ethernet (10/100/1000 Mbps Full-Duplex) |
| **Alimentación** | Fuente externa Lenovo 65W High-Efficiency (89% Efficiency) |
| **Sistema Operativo** | Ubuntu Server 24.04 LTS (Noble Numbat) sin entorno gráfico |

---

## 2. Métricas de Eficiencia Energética

El servidor está optimizado con el gobernador de energía `powersave` del kernel Linux, aprovechando los estados de reposo C-States del procesador Intel:

| Estado de Operación | Carga de CPU | Potencia Consumida (W) | Consumo Mensual (kWh) |
| :--- | :--- | :--- | :--- |
| **Reposo (Idle)** | 3% - 8% | **14.8 W** | ~10.8 kWh |
| **Carga Típica (24/7)** | 10% - 20% | **16.5 W** | ~12.2 kWh |
| **Pico (Backups / Compilación)** | 85% - 95% | **28.0 W** | Temporal (< 5 min/día) |

> **Impacto Económico**: Operar este servidor 24 horas al día los 365 días del año equivale a menos de **~12 kWh al mes** (aproximadamente el consumo de una lámpara LED moderna), reduciendo el costo eléctrico un **92%** respecto a un servidor en torre o PC de escritorio convencional.
