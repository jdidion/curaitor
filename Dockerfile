# curaitor — sandboxed triage/discover agent
# Usage:
#   docker build -t curaitor .
#   docker run --rm -v $(pwd)/.env:/app/.env:ro -v /path/to/vault:/vault curaitor /cu:triage
#
# For interactive review (needs host network for MCP servers):
#   docker run --rm -it --network host -v $(pwd)/.env:/app/.env:ro -v /path/to/vault:/vault curaitor

FROM node:22-slim

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    curl git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y gh && rm -rf /var/lib/apt/lists/*

# Python deps
RUN pip3 install --break-system-packages requests-oauthlib pyyaml

# Claude Code
RUN npm install -g @anthropic-ai/claude-code

# Plugin code
WORKDIR /app
COPY CLAUDE.md .
COPY .claude/ .claude/
COPY commands/ commands/
COPY config/default-permissions.md config/
COPY config/triage-rules.yaml config/
COPY config/feeds.yaml.example config/
COPY scripts/ scripts/
RUN chmod +x scripts/*.py scripts/*.sh

# Default permissions for the sandboxed agent
# Convert the permissions doc to a settings.json at build time
COPY docker/settings.json .claude/settings.json

# The vault mount point
VOLUME /vault

# Default: run triage in unattended mode
ENTRYPOINT ["claude", "--permission-mode", "bypassPermissions", "-p"]
CMD ["/cu:triage"]
