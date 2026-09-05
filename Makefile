.PHONY: install test backend dashboard up down

install:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
	cd dashboard && npm install

test:
	cd backend && .venv/bin/python -m pytest

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

dashboard:
	cd dashboard && npm run dev

up:
	docker compose up --build -d

down:
	docker compose down
