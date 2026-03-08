#!/usr/bin/env bash
# Macrovision — Team Dashboard
# Shows inbox and active counts for all agents at a glance.

COMMS_DIR="$(dirname "$0")/../comms"
AGENTS=("kirk" "spock" "bones" "scotty")
NAMES=("Captain Kirk" "Mr. Spock" "Dr. McCoy" "Scotty")
ROLES=("Captain" "Scientist" "Doctor" "Engineer")

printf "\n  %-16s %-14s  %s\n" "AGENT" "INBOX" "ACTIVE"
printf "  %-16s %-14s  %s\n" "────────────────" "──────────────" "──────────────"

for i in "${!AGENTS[@]}"; do
    agent="${AGENTS[$i]}"
    name="${NAMES[$i]}"

    inbox_dir="$COMMS_DIR/$agent/inbox"
    active_dir="$COMMS_DIR/$agent/active"

    inbox_count=0
    active_count=0

    if [ -d "$inbox_dir" ]; then
        inbox_count=$(find "$inbox_dir" -maxdepth 1 -name '*.md' | wc -l)
    fi
    if [ -d "$active_dir" ]; then
        active_count=$(find "$active_dir" -maxdepth 1 -name '*.md' | wc -l)
    fi

    if [ "$inbox_count" -gt 0 ]; then
        inbox_display="\033[1;33m$inbox_count\033[0m"
    else
        inbox_display="\033[0;32m$inbox_count\033[0m"
    fi

    if [ "$active_count" -gt 0 ]; then
        active_display="\033[1;36m$active_count\033[0m"
    else
        active_display="\033[0;32m$active_count\033[0m"
    fi

    printf "  %-16s " "$name"
    printf "$inbox_display"
    printf "              "
    printf "$active_display"
    printf "\n"
done

printf "\n"
