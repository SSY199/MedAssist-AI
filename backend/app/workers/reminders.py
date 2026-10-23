"""Run from backend: PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m app.workers.reminders"""
import asyncio
import logging
import time

from app.core.db import client
from app.services.reminders import setup_indexes, worker_tick


async def main():
    await setup_indexes()
    logging.info("Reminder worker started; no patient or recipient content is logged")
    try:
        while True:
            try:
                await worker_tick()
            except Exception as error:
                # Provider/DB exception text can contain private connection data.
                logging.error("Reminder worker tick failed (%s); check service configuration", type(error).__name__)
            await asyncio.sleep(15)
    finally:
        client.close()


if __name__ == "__main__":
    logging.Formatter.converter = time.gmtime
    logging.basicConfig(level=logging.INFO, format="%(asctime)sZ %(levelname)s %(message)s", datefmt="%Y-%m-%dT%H:%M:%S")
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
