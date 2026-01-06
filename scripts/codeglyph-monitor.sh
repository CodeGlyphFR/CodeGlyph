#!/bin/bash
# CodeGlyph System Monitor
# Ecrit les metriques systeme dans un fichier JSON pour l'API
#
# Installation:
#   sudo cp scripts/codeglyph-monitor.sh /usr/local/bin/
#   sudo chmod +x /usr/local/bin/codeglyph-monitor.sh
#   sudo cp scripts/codeglyph-monitor.service /etc/systemd/system/
#   sudo cp scripts/codeglyph-monitor.timer /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now codeglyph-monitor.timer
#
# Verification:
#   systemctl status codeglyph-monitor.timer
#   systemctl list-timers | grep codeglyph

OUTPUT_FILE="/home/erickdesmet/Docker_apps/codeglyph/data/system-status.json"

# Services systemd a monitorer
SYSTEMD_SERVICES=(
    "caddy.service"
    "php8.3-fpm.service"
    "pihole-FTL.service"
    "fitmycv-prod.service"
)

# Processus a verifier
PROCESSES=(
    "qbittorrent-nox"
    "tg-qb-bot/bot.py"
)

# Conteneurs Docker a ignorer (patterns grep -E)
DOCKER_BLACKLIST=(
    "^dazzling_"      # Conteneur hello-world de test
    "n8n-extensions"  # Conteneur d'installation temporaire n8n
)

# ============================================================================
# CPU Usage (moyenne sur 0.5 seconde)
# ============================================================================
get_cpu() {
    read -r cpu user1 nice1 system1 idle1 iowait1 irq1 softirq1 _ < /proc/stat
    sleep 0.5
    read -r cpu user2 nice2 system2 idle2 iowait2 irq2 softirq2 _ < /proc/stat

    idle=$((idle2 - idle1))
    total=$(( (user2 + nice2 + system2 + idle2 + iowait2 + irq2 + softirq2) - (user1 + nice1 + system1 + idle1 + iowait1 + irq1 + softirq1) ))

    if [ $total -eq 0 ]; then
        echo 0
    else
        echo $(( 100 * (total - idle) / total ))
    fi
}

# ============================================================================
# RAM Usage
# ============================================================================
get_ram() {
    free | grep Mem | awk '{printf "%d", $3/$2 * 100}'
}

# ============================================================================
# Disk Usage
# ============================================================================
get_disks() {
    local result="["
    local first=true

    # Disque racine
    root_percent=$(df / 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ -n "$root_percent" ]; then
        result+="{\"percent\":$root_percent}"
        first=false
    fi

    # Disques /mnt/*
    if [ -d "/mnt" ]; then
        for mount in /mnt/*; do
            if [ -d "$mount" ] && mountpoint -q "$mount" 2>/dev/null; then
                percent=$(df "$mount" 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
                if [ -n "$percent" ]; then
                    $first || result+=","
                    result+="{\"percent\":$percent}"
                    first=false
                fi
            fi
        done
    fi

    result+="]"
    echo "$result"
}

# ============================================================================
# Services Status
# ============================================================================
get_services() {
    local services="["
    local first=true

    # Services systemd
    for svc in "${SYSTEMD_SERVICES[@]}"; do
        $first || services+=","
        # Extraire le nom sans .service
        local name="${svc%.service}"
        if systemctl is-active --quiet "$svc" 2>/dev/null; then
            services+="{\"name\":\"$name\",\"running\":true}"
        else
            services+="{\"name\":\"$name\",\"running\":false}"
        fi
        first=false
    done

    # Processus
    for proc in "${PROCESSES[@]}"; do
        services+=","
        # Extraire le nom lisible du processus
        local name=$(basename "$proc" | sed 's/\.py$//')
        if pgrep -f "$proc" > /dev/null 2>&1; then
            services+="{\"name\":\"$name\",\"running\":true}"
        else
            services+="{\"name\":\"$name\",\"running\":false}"
        fi
    done

    # Containers Docker
    if command -v docker &> /dev/null; then
        containers=$(docker ps -a --format "{{.Names}}" 2>/dev/null)
        if [ -n "$containers" ]; then
            while IFS= read -r container; do
                if [ -n "$container" ]; then
                    # Verifier si le conteneur est dans la blacklist
                    skip=false
                    for pattern in "${DOCKER_BLACKLIST[@]}"; do
                        if echo "$container" | grep -qE "$pattern"; then
                            skip=true
                            break
                        fi
                    done

                    if [ "$skip" = false ]; then
                        services+=","
                        status=$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null)
                        if [ "$status" = "true" ]; then
                            services+="{\"name\":\"$container\",\"running\":true}"
                        else
                            services+="{\"name\":\"$container\",\"running\":false}"
                        fi
                    fi
                fi
            done <<< "$containers"
        fi
    fi

    services+="]"
    echo "$services"
}

# ============================================================================
# Main
# ============================================================================

CPU=$(get_cpu)
RAM=$(get_ram)
DISKS=$(get_disks)
SERVICES=$(get_services)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat > "$OUTPUT_FILE" << EOF
{
  "cpu": $CPU,
  "ram": $RAM,
  "disks": $DISKS,
  "services": $SERVICES,
  "timestamp": "$TIMESTAMP"
}
EOF
