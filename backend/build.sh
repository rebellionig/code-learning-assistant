#!/usr/bin/env bash
pip install -r requirements.txt
python -c "from app import init_db; init_db(); print('DB ready')"
