#!/bin/sh
cd "$(dirname "$0")"
(xdg-open index.html || open index.html) 2>/dev/null
