#!/usr/bin/env python3
"""Container entrypoint: launch nginx (static site + /photos + /api proxy),
then run the sync/API service in the foreground."""
import subprocess
import sys

subprocess.Popen(["nginx", "-g", "daemon off;"])
sys.exit(subprocess.call([sys.executable, "/opt/dashboard_service/dashboard_service.py"]))
